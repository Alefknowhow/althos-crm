'use client'

/**
 * Shared formatting helpers, small UI primitives, and status/period
 * constants for FinancialEntriesView and its split-out sub-components.
 * Split out of FinancialEntriesView.tsx.
 */

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { FinancialSettingRow } from '@/actions/financial-settings'
import { TrendingUp, TrendingDown, CalendarRange } from 'lucide-react'

export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export const STATUS_LABELS: Record<string, string> = {
  pendente: 'Pendente', pago: 'Pago', vencido: 'Vencido', cancelado: 'Cancelado',
}
export const STATUS_VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'outline'> = {
  pendente: 'warning', pago: 'success', vencido: 'destructive', cancelado: 'outline',
}

export function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
export function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}
export function fmtDate(d?: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

export function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

export function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

/** Select alimentado pelas listas cadastradas em Configurações (sem digitação livre). */
export function SettingSelect({
  value, onChange, options, placeholder = 'Selecione…', required,
}: {
  value: string | null | undefined
  onChange: (v: string | null) => void
  options: string[]
  placeholder?: string
  required?: boolean
}) {
  return (
    <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? null : v)}>
      <SelectTrigger><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {!required && <SelectItem value="__none__">— Nenhuma —</SelectItem>}
        {options.length === 0 && <SelectItem value="__empty__" disabled>Nenhum item cadastrado</SelectItem>}
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/** Junta as opções cadastradas com um valor avulso ainda não cadastrado (ex.: sugestão de IA), pra não sumir da tela até o próximo refresh. */
export function withExtra(options: FinancialSettingRow[], extra?: string | null): string[] {
  const names = options.map(o => o.name)
  if (extra && !names.some(n => n.toLowerCase() === extra.toLowerCase())) names.unshift(extra)
  return names
}

export function TipoToggle({ value, onChange }: { value: 'receita' | 'despesa'; onChange: (v: 'receita' | 'despesa') => void }) {
  return (
    <div className="flex gap-1.5">
      {(['receita', 'despesa'] as const).map(t => {
        const active = value === t
        return (
          <button
            key={t}
            type="button"
            onClick={() => onChange(t)}
            className={cn(
              'flex-1 h-9 rounded-lg border text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5',
              FOCUS_RING,
              active
                ? t === 'receita' ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/10 text-destructive border-destructive/30'
                : 'bg-background hover:bg-muted text-muted-foreground border-border',
            )}
          >
            {t === 'receita' ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {t === 'receita' ? 'Receita' : 'Despesa'}
          </button>
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Período — filtro compacto da toolbar. Local a este módulo (não usa
 * lib/utils/period-range.ts porque o Financeiro precisa de "Hoje" e "Todos
 * os períodos", que o seletor dos dashboards não tem, e filtra por
 * competência, não por um range genérico de comparação).
 * ──────────────────────────────────────────────────────────────────────── */

export type PeriodId = 'all' | 'today' | 'week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'

const PERIOD_LABELS: Record<PeriodId, string> = {
  all: 'Todos os períodos', today: 'Hoje', week: 'Esta semana', month: 'Este mês',
  last_month: 'Mês anterior', quarter: 'Este trimestre', year: 'Este ano', custom: 'Personalizado',
}

export function toISO(d: Date): string { return new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString().slice(0, 10) }

export function periodRange(id: PeriodId, customFrom: string, customTo: string): { from: string | null; to: string | null } {
  const now = new Date()
  switch (id) {
    case 'today': return { from: toISO(now), to: toISO(now) }
    case 'week': { const s = new Date(now); s.setDate(now.getDate() - now.getDay()); const e = new Date(s); e.setDate(s.getDate() + 6); return { from: toISO(s), to: toISO(e) } }
    case 'month': return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: toISO(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'last_month': return { from: toISO(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: toISO(new Date(now.getFullYear(), now.getMonth(), 0)) }
    case 'quarter': { const q = Math.floor(now.getMonth() / 3); return { from: toISO(new Date(now.getFullYear(), q * 3, 1)), to: toISO(new Date(now.getFullYear(), q * 3 + 3, 0)) } }
    case 'year': return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: toISO(new Date(now.getFullYear(), 11, 31)) }
    case 'custom': return { from: customFrom || null, to: customTo || null }
    case 'all':
    default: return { from: null, to: null }
  }
}

export function PeriodFilterDropdown({
  value, customFrom, customTo, onChange,
}: {
  value: PeriodId
  customFrom: string
  customTo: string
  onChange: (v: PeriodId, from: string, to: string) => void
}) {
  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <Select value={value} onValueChange={v => onChange(v as PeriodId, customFrom, customTo)}>
        <SelectTrigger className="h-9 text-xs w-[150px] gap-1.5">
          {/* Ícone como irmão direto do trigger (não dentro de outro <span>) —
              o seletor [&>span]:line-clamp-1 do SelectTrigger força
              -webkit-box no span filho direto, o que empurrava o ícone pra
              uma "linha" separada do texto quando os dois ficavam dentro do
              mesmo span. */}
          <CalendarRange className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.entries(PERIOD_LABELS) as [PeriodId, string][]).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
        </SelectContent>
      </Select>
      {value === 'custom' && (
        <>
          <Input type="date" className="h-9 w-[135px] text-xs" value={customFrom} onChange={e => onChange('custom', e.target.value, customTo)} />
          <Input type="date" className="h-9 w-[135px] text-xs" value={customTo} onChange={e => onChange('custom', customFrom, e.target.value)} />
        </>
      )}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Cards de resumo — 4 cards compactos, horizontais, sem gráfico.
 * ──────────────────────────────────────────────────────────────────────── */

export function SummaryCard({ label, value, icon: Icon, tone }: { label: string; value: string; icon: React.ElementType; tone: 'success' | 'destructive' | 'warning' | 'muted' }) {
  const toneClass = {
    success: 'text-success', destructive: 'text-destructive', warning: 'text-warning', muted: 'text-muted-foreground',
  }[tone]
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5 flex items-center justify-between gap-2 min-w-0">
      <div className="min-w-0">
        <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        <p className={cn('text-base font-bold tabular-nums truncate', toneClass)}>{value}</p>
      </div>
      <Icon className={cn('w-4 h-4 shrink-0 opacity-70', toneClass)} />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Componente principal
 * ──────────────────────────────────────────────────────────────────────── */

export const PAGE_SIZE = 50

export type SortKey = 'competencia' | 'vencimento' | 'valor_cents' | 'status'

