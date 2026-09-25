import { fmtAxisCompact, fmtCurrency, fmtPct } from '@/lib/dashboard/format'

/** Formatos serializáveis (Server → Client) — funções não atravessam a fronteira RSC. */
export type ValueFormat = 'currency' | 'number' | 'pct'

export function formatValue(v: number | null | undefined, f: ValueFormat): string {
  if (v === null || v === undefined) return '—'
  if (f === 'currency') return fmtCurrency(v)
  if (f === 'pct') return fmtPct(v, 1)
  return new Intl.NumberFormat('pt-BR').format(v)
}

export function formatAxis(v: number, f: ValueFormat): string {
  if (f === 'currency') return fmtAxisCompact(v)
  if (f === 'pct') return `${Math.round(v)}%`
  return new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v)
}

export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  color: 'hsl(var(--popover-foreground))',
  boxShadow: '0 4px 16px rgba(0,0,0,.12)',
}
