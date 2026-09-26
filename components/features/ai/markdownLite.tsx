/**
 * Tokenizador leve de markdown compartilhado por todos os chats de IA do
 * CRM — **negrito**, [rótulo](link) e URLs/caminhos crus como fallback.
 * Extraído de CopilotDockMessages.tsx (era duplicado em cada chat).
 */
const TOKEN_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)/g
const MD_LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/
const BARE_LINK_PATTERN = /^(https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)$/

// A IA é instruída a não repetir em texto o que um card de dados (tool_call
// com view tabular/gráfico) já mostrou, mas nem sempre segue à risca —
// às vezes reescreve a mesma tabela em markdown logo abaixo do card
// (achado real: CONSULTAR_RESERVAS respondendo com o card + a mesma tabela
// em texto). Como o card já é a fonte confiável dos dados, removemos
// blocos de tabela markdown do texto sempre que a mensagem já tiver pelo
// menos um card de dados renderizado (ver `hasRenderedDataCard` nos
// call-sites: CopilotDockMessages, InsightsChatMessages, FinancialAiChat).
const MARKDOWN_TABLE_BLOCK = /(?:^|\n)[ \t]*\|.*\|[ \t]*\n[ \t]*\|[ \t]*:?-{2,}:?[ \t]*(?:\|[ \t]*:?-{2,}:?[ \t]*)*\|[ \t]*(?:\n[ \t]*\|.*\|[ \t]*)*/g

export function stripMarkdownTables(text: string): string {
  return text
    .replace(MARKDOWN_TABLE_BLOCK, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(TOKEN_PATTERN)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    const mdLink = MD_LINK_PATTERN.exec(part)
    if (mdLink) {
      return <a key={i} href={mdLink[2]} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{mdLink[1]}</a>
    }
    if (BARE_LINK_PATTERN.test(part)) {
      return <a key={i} href={part} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{part}</a>
    }
    return <span key={i}>{part}</span>
  })
}
