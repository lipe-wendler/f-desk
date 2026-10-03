// Hook PreToolUse: o Claude não faz merge nem escreve na `main`. Sem ruleset ativo no GitHub (plano
// gratuito), o pre-push é a única trava, e ele não vale para escrita pela API do GitHub (MCP) nem
// para `git push --no-verify`. O merge é sempre de uma pessoa, depois da /revisao-de-seguranca.
import { readFileSync } from 'node:fs'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const tool = String(input.tool_name ?? '')
const args = input.tool_input ?? {}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `${reason} Regra do projeto: o merge na main é feito por uma pessoa, depois da /revisao-de-seguranca (docs/git-workflow.md).`,
      },
    }),
  )
  process.exit(0)
}

const isMain = (ref) => /^(refs\/heads\/)?main$/.test(String(ref ?? '').trim())

// MCP do GitHub (o prefixo muda conforme a instalação: mcp__github__, mcp__plugin_..._github__).
if (/^mcp__.*github.*__/i.test(tool)) {
  const action = tool.replace(/^.*__/, '')
  if (action === 'merge_pull_request' || action === 'enable_pr_auto_merge')
    deny('Merge de PR pelo Claude está bloqueado.')
  if (
    ['push_files', 'create_or_update_file', 'delete_file'].includes(action) &&
    isMain(args.branch)
  )
    deny('Escrita direta na main pela API do GitHub está bloqueada.')
}

/**
 * O comando sem o texto que é só dado: corpo de heredoc (`<<'EOF' … EOF`) e trechos entre aspas.
 * Assim uma mensagem de commit que cita `--no-verify` ou `main` não conta como push.
 */
function executable(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, ' ')
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
}

if (tool === 'Bash') {
  const command = executable(String(args.command ?? ''))
  if (/\bgh\s+pr\s+merge\b/.test(command)) deny('Merge de PR pelo Claude está bloqueado.')
  if (/\bgh\s+api\b[^\n]*\/merges?\b/.test(command))
    deny('Merge pela API do GitHub está bloqueado.')

  // Cada `git push` do comando, até o próximo separador.
  for (const [push] of command.matchAll(/\bgit\b[^;&|\n]*?\bpush\b[^;&|\n]*/g)) {
    if (/\s(--no-verify|-n)(\s|$)/.test(push)) deny('`git push --no-verify` está bloqueado.')
    // Destino main: `main`, `HEAD:main`, `x:refs/heads/main`, `:main` (apagar).
    if (/(^|\s|:)(refs\/heads\/)?main(\s|$)/.test(push.replace(/^.*?\bpush\b/, ' ')))
      deny('Push para a main está bloqueado.')
  }
  // Desligar os hooks do Git para o push.
  if (/\bHUSKY=0\b|core\.hooksPath/.test(command) && /\bpush\b/.test(command))
    deny('Push com os hooks do Git desligados está bloqueado.')
}

process.exit(0)
