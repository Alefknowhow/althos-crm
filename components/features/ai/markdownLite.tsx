/**
 * Tokenizador leve de markdown compartilhado por todos os chats de IA do
 * CRM — **negrito**, [rótulo](link) e URLs/caminhos crus como fallback.
 * Extraído de CopilotDockMessages.tsx (era duplicado em cada chat).
 */
const TOKEN_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)/g
const MD_LINK_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/
const BARE_LINK_PATTERN = /^(https?:\/\/[^\s)]+|\/voucher-print\/[^\s)]+)$/

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
