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

const SHELL = /^(sh|bash|zsh|dash|ksh)$/
const READS_COMMANDS = /(^|[\s;&|(/])(sh|bash|zsh|dash|ksh|source|eval|xargs|\.)(\s|$)/

/** O texto termina dentro de aspas ou de um comentário (`#` no começo de uma palavra)? */
function inQuoteOrComment(text) {
  let quote = null
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quote) {
      if (ch === quote) quote = null
      else if (ch === '\\' && quote === '"') i++
    } else if (ch === '\\') i++
    else if (ch === "'" || ch === '"') quote = ch
    else if (ch === '#' && (i === 0 || /\s/.test(text[i - 1]))) return true
  }
  return quote !== null
}

/**
 * Tira o corpo dos heredocs (`<<'EOF'` … `EOF`): é texto passado ao comando, não comando. O resto
 * da linha do `<<EOF` fica, porque o shell o executa (`cat <<EOF && git push …`). Quando quem lê o
 * corpo é um shell (`bash <<EOF`), o corpo é comando e fica. `<<<` (here-string) e `<<` entre aspas
 * ou depois de `#` não abrem heredoc. Varredura linha a linha, sem regex com retrocesso.
 */
function withoutHeredocs(command) {
  const lines = command.split('\n')
  const out = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /(?<!<)<<(?!<)-?\s*(['"]?)(\w+)\1/.exec(line)
    const before = m ? line.slice(0, m.index) : ''
    // Dentro de `$(( … ))` / `(( … ))`, `<<` é deslocamento de bits, não heredoc.
    const arithmetic = (before.match(/\(\(/g) ?? []).length > (before.match(/\)\)/g) ?? []).length
    const end =
      m && !arithmetic && !inQuoteOrComment(before)
        ? lines.findIndex((l, j) => j > i && l.trim() === m[2])
        : -1
    if (end < 0) {
      out.push(line)
      continue
    }
    out.push(before + ' ' + line.slice(m.index + m[0].length))
    if (READS_COMMANDS.test(before)) out.push(...lines.slice(i + 1, end))
    i = end
  }
  return out.join('\n')
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
 * O comando com o conteúdo entre aspas simples apagado (ali o shell não substitui `$(…)` nem
 * crases). Aspas simples dentro de aspas duplas são texto comum e não apagam nada.
 */
function withoutSingleQuoted(command) {
  let out = ''
  let quote = null
  for (let i = 0; i < command.length; i++) {
    const ch = command[i]
    if (quote === "'") {
      if (ch === "'") quote = null
      continue
    }
    // Caractere escapado (`\$`, `\'`, `\"`) é texto: não abre aspas nem substituição.
    if (ch === '\\') {
      i++
      continue
    }
    if (quote === '"' && ch === '"') quote = null
    else if (!quote && (ch === "'" || ch === '"')) quote = ch
    out += ch
  }
  return out
}

/**
 * Comandos que o shell roda dentro deste: `$(…)` e crases (fora de aspas simples, onde o shell não
 * substitui), `sh -c "…"` / `bash -lc "…"`, `eval …` e `env -S "…"`. São conferidos à parte.
 */
function nestedCommands(command, segs) {
  const unquoted = withoutSingleQuoted(command)
  const nested = [...unquoted.matchAll(/\$\(([^()]*)\)|`([^`]*)`/g)].map((m) => m[1] ?? m[2])
  for (const seg of segs) {
    const shell = seg.findIndex((t) => SHELL.test(base(t)))
    seg.forEach((t, i) => {
      const prev = seg[i - 1] ?? ''
      if (shell >= 0 && i > shell && /^-[a-z]*c[a-z]*$/.test(prev)) nested.push(t)
      if (/^(-[a-zA-Z]*S|--split-string)$/.test(prev) && seg.some((x) => base(x) === 'env'))
        nested.push(t)
      if (/^--split-string=/.test(t)) nested.push(t.slice(t.indexOf('=') + 1))
    })
    const ev = seg.indexOf('eval')
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
  // `git stash push` guarda alterações locais; não é push para o remoto.
  // Só vale quando `stash` é o subcomando logo depois do `git`: `git --work-tree stash push` é push.
  const stash = seg[start + 1] === 'stash' ? start + 2 : -1
  const at = seg.findIndex((t, i) => i > start && i !== stash && t === 'push')
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
 * Regras que valem para o trecho do git inteiro (inclusive o que vem antes do `git`, como variáveis
 * de ambiente), ache ou não o `push`: alias definido na hora (`-c alias.p=push`, `git config alias.p
 * push`) esconde o subcomando; `core.hooksPath` (a chave não diferencia maiúsculas) desliga o
 * `pre-push`, por `-c`, `--config-env`, `git config` (que grava para as próximas chamadas) ou pelas
 * variáveis `GIT_CONFIG_*`, que passam qualquer configuração sem aparecer depois do `git`.
 */
function checkGitSegment(seg) {
  if (seg.some((t) => /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+|PARAMETERS)=/.test(t)))
    deny('Configuração do git por variável de ambiente (`GIT_CONFIG_*`) está bloqueada.')
  if (seg.some((t) => /(^|^-c|=)alias\./i.test(t) || t.startsWith('--config-env')))
    deny('Alias do git definido no comando está bloqueado (pode esconder um push).')
  // Só leitura (`git config --get core.hooksPath`) é diagnóstico e fica liberada.
  const git = seg.findIndex(isGit)
  const readsConfig =
    seg[git + 1] === 'config' &&
    !gitPushArgs(seg) &&
    seg.some((t) => /^--(get|get-all|get-regexp|list)$|^-l$/.test(t))
  if (!readsConfig && seg.some((t) => /core\.hookspath/i.test(t)))
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

/** Primeiro argumento depois de `i` que não é opção (`-R dono/repo` e `--repo x` levam valor). */
function nextArg(tokens, i) {
  let j = i + 1
  while (j < tokens.length && tokens[j].startsWith('-'))
    j += /^(-R|--repo)$/.test(tokens[j]) ? 2 : 1
  return tokens[j]
}

function checkGh(seg) {
  const start = seg.findIndex((t) => base(t) === 'gh')
  if (start < 0) return
  // Procura o subcomando depois de opções globais (`gh -R dono/repo pr merge`, `gh pr -R x merge`).
  const rest = seg.slice(start + 1)
  const pr = rest.indexOf('pr')
  if (pr >= 0 && nextArg(rest, pr) === 'merge') deny('Merge de PR pelo Claude está bloqueado.')
  // Alias do gh pode esconder `pr merge` ou `api` (`gh alias set m 'pr merge'`).
  const alias = rest.indexOf('alias')
  if (
    alias >= 0 &&
    /^(set|import)$/.test(nextArg(rest, alias) ?? '') &&
    rest.some((t) => /merge|api/.test(t))
  )
    deny('Alias do gh com `merge` ou `api` está bloqueado.')
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

function checkCommand(command, depth = 0, huskyOff = false) {
  const clean = withoutHeredocs(command)
  const segs = segments(clean)
  // `HUSKY=0` desliga o pre-push em qualquer ponto do comando (`export HUSKY=0 && git push …`) e
  // vale também para os comandos de dentro (`HUSKY=0 sh -c "git push …"`).
  const husky = huskyOff || segs.flat().some((t) => /^HUSKY=0$/.test(t))
  for (const seg of segs) {
    if (seg.some(isGit)) checkGitSegment(seg)
    const pushArgs = gitPushArgs(seg)
    if (pushArgs) {
      if (husky) deny('Push com os hooks do Git desligados está bloqueado.')
      checkGitPush(pushArgs)
    }
    checkGh(seg)
  }
  if (depth < 3)
    for (const inner of nestedCommands(clean, segs)) checkCommand(inner, depth + 1, husky)
}

if (tool === 'Bash') checkCommand(String(args.command ?? ''))

process.exit(0)
