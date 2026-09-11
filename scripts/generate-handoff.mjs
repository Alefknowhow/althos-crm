#!/usr/bin/env node
/**
 * scripts/generate-handoff.mjs — Handoff Automation do Althos Harness.
 *
 * Coleta o estado do Git (branch, último commit, status, diff --stat,
 * commits recentes) e escreve APENAS a seção "Automatic Context" de
 * .ai/HANDOFF.md, entre os marcadores <!-- AUTO:BEGIN --> / <!-- AUTO:END -->.
 * Nunca toca na seção "Agent Context" (escrita à mão pelo agente) nem em
 * qualquer outro arquivo.
 *
 * Nunca lê nem imprime conteúdo de diff — só nomes de arquivo e
 * contagem de linhas (`git diff --stat`), que já não carrega segredo
 * nenhum por natureza. Arquivos com nome sensível (.env*, credenciais,
 * *secret*, *.key, *.pem, *token*) aparecem sinalizados, nunca com detalhe.
 *
 * Não faz `git add`/`commit`/`push` — é só leitura + escrita local no
 * arquivo de handoff.
 *
 * Uso: `npm run handoff`
 */

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const HANDOFF_PATH = path.join(ROOT, '.ai', 'HANDOFF.md')

const SENSITIVE_PATTERN = /(^|\/)\.env(\..*)?$|credencia|secret|\.key$|\.pem$|token/i

function sh(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return fallback
  }
}

/** Como sh(), mas só remove newline(s) finais — nunca espaços à esquerda.
 *  `git status --porcelain` usa colunas de largura fixa (status de 2
 *  caracteres, ex.: " M", "??", "A "); um .trim() ingênuo come o espaço
 *  inicial da primeira linha e desalinha o parse de todas as colunas. */
function shRaw(cmd, fallback = '') {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).replace(/\r?\n+$/, '')
  } catch {
    return fallback
  }
}

function redactSensitiveLines(statOutput) {
  if (!statOutput) return '_(nenhuma alteração)_'
  return statOutput
    .split('\n')
    .map(line => {
      const filePart = line.split('|')[0]?.trim() ?? ''
      if (filePart && SENSITIVE_PATTERN.test(filePart)) {
        return `${filePart} | [alteração sensível — conteúdo omitido, revisar manualmente antes de commitar]`
      }
      return line
    })
    .join('\n')
}

function detectNpmScripts() {
  const pkgPath = path.join(ROOT, 'package.json')
  if (!existsSync(pkgPath)) return []
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
  return Object.keys(pkg.scripts ?? {})
}

function collectAutomaticContext() {
  const generatedAt = new Date().toISOString()
  const branch = sh('git rev-parse --abbrev-ref HEAD', 'desconhecida')
  const lastCommit = sh('git log -1 --format="%h %s (%an, %ar)"', '(nenhum commit)')
  const recentCommits = sh('git log -10 --format="- %h %s"', '_(nenhum)_')

  const statusPorcelain = shRaw('git status --porcelain=v1')
  const staged = []
  const unstaged = []
  const untracked = []
  for (const line of statusPorcelain ? statusPorcelain.split(/\r?\n/) : []) {
    if (!line) continue
    const indexState = line[0]
    const worktreeState = line[1]
    const file = line.slice(3)
    if (indexState !== ' ' && indexState !== '?') staged.push(`${indexState} ${file}`)
    if (worktreeState !== ' ' && worktreeState !== '?') unstaged.push(`${worktreeState} ${file}`)
    if (indexState === '?' && worktreeState === '?') untracked.push(file)
  }

  const stagedDiffStat = redactSensitiveLines(sh('git diff --cached --stat'))
  const unstagedDiffStat = redactSensitiveLines(sh('git diff --stat'))

  const npmScripts = detectNpmScripts()
  const knownVerification = [
    npmScripts.includes('lint') ? '`npm run lint` (disponível)' : '`npm run lint` (não configurado)',
    '`npx tsc --noEmit` (typecheck — sem script dedicado no package.json, convenção do projeto via AGENTS.md/CI)',
    npmScripts.includes('test') ? '`npm test` (disponível)' : '`npm test` (não configurado)',
    npmScripts.includes('build') ? '`npm run build` (disponível)' : '`npm run build` (não configurado)',
    existsSync(path.join(ROOT, 'scripts', 'verify.sh')) ? '`bash scripts/verify.sh` (pipeline completo — mesmo do CI)' : null,
  ].filter(Boolean)

  return `
**Generated At**: ${generatedAt}
**Branch**: \`${branch}\`
**Last Commit**: ${lastCommit}

**Recent Commits**:
${recentCommits}

**Staged Files** (${staged.length}):
${staged.length ? staged.map(f => `- ${f}`).join('\n') : '_(nenhum)_'}

**Unstaged Changes** (${unstaged.length}):
${unstaged.length ? unstaged.map(f => `- ${f}`).join('\n') : '_(nenhum)_'}

**Untracked Files** (${untracked.length}):
${untracked.length ? untracked.map(f => `- ${f}`).join('\n') : '_(nenhum)_'}

**Staged Diff Summary**:
\`\`\`
${stagedDiffStat}
\`\`\`

**Unstaged Diff Summary**:
\`\`\`
${unstagedDiffStat}
\`\`\`

**Verification Commands Available in This Repo**:
${knownVerification.map(c => `- ${c}`).join('\n')}
`.trim()
}

function updateHandoffFile(autoContent) {
  if (!existsSync(HANDOFF_PATH)) {
    console.error(`[handoff] ${HANDOFF_PATH} não existe. Crie o arquivo a partir do template antes de rodar este script.`)
    process.exit(1)
  }
  const original = readFileSync(HANDOFF_PATH, 'utf8')
  const beginMarker = '<!-- AUTO:BEGIN -->'
  const endMarker = '<!-- AUTO:END -->'
  const beginIdx = original.indexOf(beginMarker)
  const endIdx = original.indexOf(endMarker)

  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
    console.error('[handoff] Marcadores <!-- AUTO:BEGIN --> / <!-- AUTO:END --> não encontrados (ou fora de ordem) em .ai/HANDOFF.md. Não sobrescrevendo nada — corrija o arquivo manualmente.')
    process.exit(1)
  }

  const before = original.slice(0, beginIdx + beginMarker.length)
  const after = original.slice(endIdx)
  const updated = `${before}\n${autoContent}\n${after}`

  writeFileSync(HANDOFF_PATH, updated, 'utf8')
}

const autoContent = collectAutomaticContext()
updateHandoffFile(autoContent)

console.log('[handoff] .ai/HANDOFF.md — seção "Automatic Context" atualizada.')
console.log('[handoff] Próximo passo: preencha/atualize manualmente a seção "Agent Context" (Summary, Completed, Pending, Recommended Next Steps, etc.) e .ai/CURRENT_TASK.md.')
console.log('[handoff] Este script não fez git add/commit/push — nenhuma alteração de código foi tocada.')
