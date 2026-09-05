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

// 8 cores determinísticas por vendedor, indexadas por hash do user_id — o
// mesmo vendedor sempre pega a mesma cor em toda a lista.
const SELLER_LABEL_COLORS = [
  'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
  'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
  'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300',
  'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
  'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
]

export function sellerLabelColor(userId: string | null | undefined): string {
  if (!userId) return 'bg-muted text-muted-foreground'
  let h = 0
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0
  return SELLER_LABEL_COLORS[h % SELLER_LABEL_COLORS.length]
}
