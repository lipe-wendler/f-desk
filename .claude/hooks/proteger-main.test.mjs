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

test('não se perde com opções globais do git, sudo ou alias', () => {
  for (const cmd of [
    'git --git-dir .git push origin main',
    'git --git-dir .git -c core.hooksPath=/dev/null push origin main',
    'git --work-tree . --namespace x push origin main',
    'sudo -u git git push origin main',
    'env -u git git push origin main',
    'git -c alias.p=push p origin main',
    'git -c alias.p=push -c core.hooksPath=/dev/null p origin main',
    'git config alias.p push',
    'git --config-env=core.hooksPath=X push origin feat/x',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('confere os hooks do Git no comando inteiro, sem diferenciar maiúsculas', () => {
  for (const cmd of [
    'export HUSKY=0 && git push origin feat/x',
    'HUSKY=0; git push origin feat/x',
    'git config core.hooksPath /dev/null && git push origin feat/x',
    'git config core.hooksPath /dev/null',
    'git -c core.hookspath=/dev/null push origin feat/x',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('enxerga comandos dentro de outro shell, heredoc e continuação de linha', () => {
  for (const cmd of [
    'cat <<EOF && git push origin main\nx\nEOF',
    'sh -c "git push origin main"',
    "bash -lc 'git push --no-verify origin feat/x'",
    'eval "git push origin main"',
    'echo "$(git push origin main)"',
    'echo `git push origin main`',
    'git push origin ma\\\nin',
    'gh -R dono/repo pr merge 1',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('continua liberando o uso comum do git e do gh', () => {
  for (const cmd of [
    'HUSKY=0 git commit -m "chore: ajusta-algo"',
    'git log --oneline main..HEAD',
    'git diff origin/main...HEAD',
    "git commit -m 'docs: o hook barra git push origin main'",
    'git commit -F - <<EOF\nfix: barra git push origin main\nEOF',
    'sh -c "pnpm lint && pnpm test"',
    'git push -u origin fix/hook && gh pr view 22',
    'git config user.name "Felipe"',
  ]) {
    assert.equal(bash(cmd), 'allow', cmd)
  }
})

test('barra configuração do git por ambiente, heredoc lido por shell e merge com opções no gh', () => {
  for (const cmd of [
    'GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=core.hooksPath GIT_CONFIG_VALUE_0=/dev/null git -c remote.origin.push=HEAD:refs/heads/main push origin',
    "GIT_CONFIG_PARAMETERS=\"'core.hooksPath'='/dev/null'\" git push origin feat/x",
    "env -S 'git -c core.hooksPath=/dev/null push origin feat/x'",
    "bash <<'EOF'\ngit push --no-verify origin main\nEOF",
    'sh <<EOF\ngit push origin main\nEOF',
    'cat <<<EOF\ngit push --no-verify origin main\nEOF',
    'echo "<<EOF"\ngit push --no-verify origin main\nEOF',
    'HUSKY=0 sh -c "git push origin feat/x"',
    'gh pr -R lipe-wendler/h1-tecnologia merge 3 --squash',
    "gh alias set m 'pr merge'",
    'git -c core.hooksPath=/dev/null push origin feat/x --list',
  ]) {
    assert.equal(bash(cmd), 'deny', cmd)
  }
})

test('não barra stash, leitura de config nem crases em aspas simples', () => {
  for (const cmd of [
    'git stash push -m main',
    'git stash push --all',
    'git config --get core.hooksPath',
    "git commit -m 'docs: explica \`git push origin main\`'",
    'gh pr create --title "fix: x" --body "$(cat <<\'EOF\'\ncorpo\nEOF\n)"',
    'gh pr view 3 --json mergeable',
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
