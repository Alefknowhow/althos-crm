import type { ProposalRow } from '@/actions/travel-proposals'

export function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
export function fmtTimestamp(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}
export function destOf(p: ProposalRow) {
  return (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
}

// 6 cores sólidas determinísticas por vendedor (paleta categórica do
// design system), indexadas por hash do user_id — o mesmo vendedor
// sempre pega a mesma cor em toda a lista.
const SELLER_LABEL_COLORS = [
  'bg-[color:var(--chart-1)] text-white',
  'bg-[color:var(--chart-2)] text-white',
  'bg-[color:var(--chart-3)] text-white',
  'bg-[color:var(--chart-4)] text-white',
  'bg-[color:var(--chart-5)] text-white',
  'bg-[color:var(--chart-6)] text-white',
]

export function sellerLabelColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted-foreground/60 text-white'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return SELLER_LABEL_COLORS[h % SELLER_LABEL_COLORS.length]
}

/** Status real da cotação (travel_proposals.status) — mapeado pro rótulo e
 *  cor sólida do design system. Valores fora da lista conhecida caem no
 *  fallback (capitaliza o texto cru, cor neutra) em vez de inventar estado. */
export const PROPOSAL_STATUS_META: Record<string, { label: string; cls: string }> = {
  draft:    { label: 'Rascunho', cls: 'bg-warning text-warning-foreground' },
  sent:     { label: 'Enviada', cls: 'bg-info text-info-foreground' },
  approved: { label: 'Aprovada', cls: 'bg-success text-success-foreground' },
  rejected: { label: 'Recusada', cls: 'bg-destructive text-destructive-foreground' },
  expired:  { label: 'Expirada', cls: 'bg-destructive text-destructive-foreground' },
}

export function proposalStatusMeta(status: string): { label: string; cls: string } {
  return PROPOSAL_STATUS_META[status] || { label: status.charAt(0).toUpperCase() + status.slice(1), cls: 'bg-muted-foreground/60 text-white' }
}
