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

/** Remove o corpo de heredoc (`<<'EOF' … EOF`): é texto passado ao comando, não argumento. */
function withoutHeredocs(command) {
  return command.replace(/<<-?\s*(['"]?)(\w+)\1[^\n]*\n[\s\S]*?\n\s*\2(?=\n|$)/g, ' ')
}

/**
 * Separa o comando em trechos (`;`, `&`, `|`, quebra de linha, subshell) e cada trecho em
 * argumentos, como o shell faz: as aspas agrupam e somem, mas o conteúdo continua sendo argumento.
 * Assim `git push "--no-verify" origin "HEAD:main"` é lido como o shell o executa, e uma mensagem
 * de commit que cita `main` não vira destino de push (ela é um argumento do `git commit`).
 */
function segments(command) {
  const out = [[]]
  let token = null
  let quote = null
  const push = () => {
    if (token !== null) out.at(-1).push(token)
    token = null
  }
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (quote === "'") {
      if (ch === "'") quote = null
      else token += ch
    } else if (quote === '"') {
      if (ch === '"') quote = null
      else if (ch === '\\' && i + 1 < command.length) token += command[++i]
      else token += ch
    } else if (ch === "'" || ch === '"') {
      quote = ch
      token ??= ''
    } else if (ch === '\\' && i + 1 < command.length) {
      token = (token ?? '') + command[++i]
    } else if (/\s/.test(ch) && ch !== '\n') {
      push()
    } else if (/[;&|\n()`]/.test(ch)) {
      push()
      out.push([])
    } else {
      token = (token ?? '') + ch
    }
  }
  push()
  return out.filter((seg) => seg.length > 0)
}

const base = (token) => token.replace(/^.*\//, '')
const isMainRef = (ref) => /^(refs\/heads\/)?main$/.test(ref)

/** Argumentos do `git push` do trecho (depois das opções globais do git), ou `null`. */
function gitPushArgs(seg) {
  const start = seg.findIndex((t) => base(t) === 'git')
  if (start < 0) return null
  let i = start + 1
  while (i < seg.length && seg[i].startsWith('-')) {
    // Opções globais com valor separado: `-C <dir>`, `-c <chave=valor>`.
    i += seg[i] === '-C' || seg[i] === '-c' ? 2 : 1
  }
  return seg[i] === 'push' ? seg.slice(i + 1) : null
}

function checkGitPush(seg, args) {
  for (const arg of args) {
    // O git aceita opção longa abreviada: `--no-verif`, `--no-ve`…
    if (arg.length >= 6 && '--no-verify'.startsWith(arg))
      deny('`git push --no-verify` está bloqueado.')
    if (arg === '--all' || (arg.length >= 5 && '--mirror'.startsWith(arg)))
      deny('Push de todas as branches (inclui a main) está bloqueado.')
    if (arg.startsWith('-')) continue
    // Destino main: `main`, `HEAD:main`, `+x:refs/heads/main`, `:main` (apagar).
    const dst = arg.replace(/^\+/, '').split(':').at(-1)
    if (isMainRef(dst)) deny('Push para a main está bloqueado.')
  }
  // Desligar os hooks do Git para o push.
  if (seg.some((t) => t === 'HUSKY=0' || t.includes('core.hooksPath')))
    deny('Push com os hooks do Git desligados está bloqueado.')
}

/** `gh api` que escreve: método diferente de GET ou campos (que viram POST). */
function isGhApiWrite(args) {
  let method = null
  let fields = false
  for (let i = 0; i < args.length; i++) {
    const t = args[i]
    if (t === '-X' || t === '--method') method = args[i + 1] ?? null
    else if (t.startsWith('--method=')) method = t.slice(9)
    else if (/^-X./.test(t)) method = t.slice(2)
    else if (/^(-f|-F|--field|--raw-field|--input)(=|$)/.test(t) || /^-[fF]./.test(t)) fields = true
  }
  return method ? method.toUpperCase() !== 'GET' : fields
}

function checkGh(seg) {
  const start = seg.findIndex((t) => base(t) === 'gh')
  if (start < 0) return
  const [sub, action] = seg.slice(start + 1)
  if (sub === 'pr' && action === 'merge') deny('Merge de PR pelo Claude está bloqueado.')
  if (sub !== 'api') return
  const args = seg.slice(start + 2)
  if (
    args.some((t) =>
      /mergePullRequest|updateRef|createCommitOnBranch|enablePullRequestAutoMerge/.test(t),
    )
  )
    deny('Merge ou escrita em branch pela API GraphQL do GitHub está bloqueado.')
  if (!isGhApiWrite(args)) return
  if (args.some((t) => /\/merges?\b/.test(t))) deny('Merge pela API do GitHub está bloqueado.')
  if (args.some((t) => /refs\/heads\/main\b|\/contents\//.test(t)))
    deny('Escrita na main pela API do GitHub está bloqueada.')
}

if (tool === 'Bash') {
  for (const seg of segments(withoutHeredocs(String(args.command ?? '')))) {
    const pushArgs = gitPushArgs(seg)
    if (pushArgs) checkGitPush(seg, pushArgs)
    checkGh(seg)
  }
}

process.exit(0)
