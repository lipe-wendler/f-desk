// Testes do hook proteger-main: `pnpm test:hooks` (roda junto com `pnpm test` e no CI).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'

const HOOK = new URL('./proteger-main.mjs', import.meta.url).pathname

function decision(tool_name, tool_input) {
  const res = spawnSync('node', [HOOK], { input: JSON.stringify({ tool_name, tool_input }) })
  const out = res.stdout.toString().trim()
  return out ? JSON.parse(out).hookSpecificOutput.permissionDecision : 'allow'
}
const bash = (command) => decision('Bash', { command })

test('bloqueia push para a main, com ou sem aspas', () => {
  for (const cmd of [
    'git push origin main',
    'git push origin HEAD:main',
    'git push origin +feat/x:refs/heads/main',
    'git push origin :main',
    'git push "origin" "HEAD:main"',
    "git push origin 'HEAD:main'",
    'git -C /repo push origin main',
    'cd /repo && git push -u origin main',
    'echo ok; git push origin main',
    'git push --all origin',
    'git push --mirror',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('bloqueia push sem os hooks do Git', () => {
  for (const cmd of [
    'git push --no-verify origin feat/x',
    'git push "--no-verify" origin "HEAD:main"',
    'git push --no-verif origin feat/x',
    'HUSKY=0 git push origin feat/x',
    'git -c core.hooksPath=/dev/null push origin feat/x',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('bloqueia merge e escrita na main pelo gh', () => {
  for (const cmd of [
    'gh pr merge 1 --squash',
    'gh api -X PATCH repos/o/r/git/refs/heads/main -f sha=abc -F force=true',
    'gh api --method PUT repos/o/r/contents/a.txt -f branch=main -f content=x',
    'gh api repos/o/r/merges -f base=main -f head=x',
    'gh api -XPUT repos/o/r/pulls/1/merge',
    "gh api graphql -f query='mutation { mergePullRequest(input: {}) { clientMutationId } }'",
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('libera o fluxo normal da branch da tarefa', () => {
  for (const cmd of [
    'git push -u origin feat/registro-de-servicos',
    'git push -n origin feat/x',
    'git commit -m "fix: corrige push para a main no hook"',
    "git commit -q -m 'docs: explica que nunca se faz git push origin main'",
    'git fetch origin main && git merge origin/main',
    'git checkout main',
    'gh api repos/o/r/contents/README.md',
    'gh api repos/o/r/git/refs/heads/main',
    'gh pr view 1',
  ]) {
    assert.equal(bash(cmd), 'allow', cmd)
  }
})

test('bloqueia merge e escrita na main pelo MCP do GitHub', () => {
  assert.equal(decision('mcp__github__merge_pull_request', { pullNumber: 1 }), 'deny')
  assert.equal(decision('mcp__github__enable_pr_auto_merge', { pullNumber: 1 }), 'deny')
  assert.equal(decision('mcp__github__push_files', { branch: 'main' }), 'deny')
  assert.equal(
    decision('mcp__github__create_or_update_file', { branch: 'refs/heads/main' }),
    'deny',
  )
  assert.equal(decision('mcp__github__push_files', { branch: 'feat/x' }), 'allow')
})
