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
 * Remove o corpo de heredoc (`<<'EOF'` … `EOF`): é texto passado ao comando, não argumento. O resto
 * da linha do `<<EOF` fica, porque o shell o executa (`cat <<EOF && git push …`).
 */
function withoutHeredocs(command) {
  return command.replace(/<<-?\s*(['"]?)(\w+)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g, ' $3')
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
    // `\` + quebra de linha é continuação: o shell junta as duas linhas.
    if (ch === '\\' && command[i + 1] === '\n' && quote !== "'") {
      i++
      continue
    }
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

/**
 * Comandos que o shell roda dentro deste: `$(…)` e crases (inclusive entre aspas duplas),
 * `sh -c "…"` / `bash -lc "…"` e `eval …`. São conferidos como comandos à parte.
 */
function nestedCommands(command, segs) {
  const nested = [...command.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)].map((m) => m[1] ?? m[2])
  for (const seg of segs) {
    seg.forEach((t, i) => {
      const prev = seg[i - 1] ?? ''
      const shell = seg.slice(0, i).some((x) => /^(sh|bash|zsh|dash|ksh)$/.test(base(x)))
      if (shell && /^-[a-z]*c[a-z]*$/.test(prev)) nested.push(t)
    })
    const ev = seg.findIndex((t) => t === 'eval')
    if (ev >= 0) nested.push(seg.slice(ev + 1).join(' '))
  }
  return nested
}

const base = (token) => token.replace(/^.*\//, '')
const isMainRef = (ref) => /^(refs\/heads\/)?main$/.test(ref)
const isGit = (t) => base(t) === 'git'

/**
 * Argumentos do `git push` do trecho, ou `null`. Procura `push` depois de qualquer `git` do trecho
 * (`sudo -u git git push`, `git --git-dir .git push`, `git -c x=y push`), sem depender de saber
 * quais opções globais do git levam valor.
 */
function gitPushArgs(seg) {
  const start = seg.findIndex(isGit)
  if (start < 0) return null
  const at = seg.indexOf('push', start + 1)
  return at < 0 ? null : seg.slice(at + 1)
}

function checkGitPush(args) {
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
}

/**
 * Regras que valem para o trecho do git inteiro, ache ou não o `push`: alias definido na hora
 * (`-c alias.p=push`, `git config alias.p push`) esconde o subcomando, e `core.hooksPath` (a chave
 * não diferencia maiúsculas) desliga o `pre-push`, seja por `-c`, `--config-env` ou `git config`,
 * que grava a troca para as próximas chamadas.
 */
function checkGitSegment(seg) {
  const rest = seg.slice(seg.findIndex(isGit) + 1)
  if (rest.some((t) => /(^|^-c|=)alias\./i.test(t) || t.startsWith('--config-env')))
    deny('Alias do git definido no comando está bloqueado (pode esconder um push).')
  if (rest.some((t) => /core\.hookspath/i.test(t)))
    deny('Trocar o `core.hooksPath` (desliga os hooks do Git) está bloqueado.')
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
  // Procura o subcomando depois de opções globais (`gh -R dono/repo pr merge`).
  const rest = seg.slice(start + 1)
  const pr = rest.indexOf('pr')
  if (pr >= 0 && rest[pr + 1] === 'merge') deny('Merge de PR pelo Claude está bloqueado.')
  const api = rest.indexOf('api')
  if (api < 0) return
  const args = rest.slice(api + 1)
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

function checkCommand(command, depth = 0) {
  const clean = withoutHeredocs(command)
  const segs = segments(clean)
  const tokens = segs.flat()
  let pushes = false
  for (const seg of segs) {
    if (seg.some(isGit)) checkGitSegment(seg)
    const pushArgs = gitPushArgs(seg)
    if (pushArgs) {
      pushes = true
      checkGitPush(pushArgs)
    }
    checkGh(seg)
  }
  // `HUSKY=0` desliga o pre-push em qualquer ponto do comando (`export HUSKY=0 && git push …`).
  if (pushes && tokens.some((t) => /^HUSKY=0$/.test(t)))
    deny('Push com os hooks do Git desligados está bloqueado.')
  if (depth < 3) for (const inner of nestedCommands(clean, segs)) checkCommand(inner, depth + 1)
}

if (tool === 'Bash') checkCommand(String(args.command ?? ''))

process.exit(0)
