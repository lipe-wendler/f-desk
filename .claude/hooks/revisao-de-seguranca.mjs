// Hook PostToolUse: depois que o Claude abre um PR (MCP do GitHub ou `gh pr create`), lembra de rodar
// a /revisao-de-seguranca nesse PR. Só injeta contexto; nunca bloqueia nada. Da entrada, só o número
// do PR (dígitos) chega ao texto injetado: nada de fora vira instrução nem é executado.
import { readFileSync } from 'node:fs'

let input
try {
  input = JSON.parse(readFileSync(0, 'utf8'))
} catch {
  process.exit(0)
}

const isGitHubCreate = input.tool_name === 'mcp__github__create_pull_request'
const command = input.tool_input?.command ?? ''
const isGhCreate = input.tool_name === 'Bash' && /\bgh\s+pr\s+create\b/.test(command)
if (!isGitHubCreate && !isGhCreate) process.exit(0)

// O resultado traz a URL do PR criado (`.../pull/123`); sem ela, a ferramenta falhou. No `gh`, só a
// saída padrão conta (o erro "a pull request already exists" cita outro PR) e vale a última URL,
// para comandos compostos que listam PRs antes de criar.
const response = input.tool_response ?? input.tool_result ?? {}
const text = isGitHubCreate
  ? String(response.url ?? JSON.stringify(response))
  : String(response.stdout ?? '')
const number = [...text.matchAll(/\/pull\/(\d+)/g)].at(-1)?.[1]
if (!number) process.exit(0)

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext:
        `PR #${number} aberto. Regra do projeto (CLAUDE.md): antes de encerrar, rode a skill ` +
        `revisao-de-seguranca com o argumento ${number} e publique o veredito no PR. ` +
        'Veredito "Bloqueado" impede o merge até os achados serem corrigidos.',
    },
  }),
)
