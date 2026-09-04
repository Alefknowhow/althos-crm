'use client'

/**
 * Drill-down row components (ad-set / ad level) and shared status/
 * conversion cells for CampaignsTable. Split out of CampaignsTable.tsx.
 */

import { Badge } from '@/components/ui/badge'
import { TableCell, TableRow } from '@/components/ui/table'
import { ChevronRight, Loader2, RotateCcw } from 'lucide-react'
import type { DrillDownRow, DrillDownError } from '@/actions/marketing'
import type { ObjectiveGroup } from '@/lib/marketing/objective'

export const DRILL_DOWN_ERROR_LABEL: Record<DrillDownError, string> = {
  token_expired: 'Token da conta expirou — reconecte em Campanhas → Contas.',
  not_found: 'Não encontrado na Meta (pode ter sido excluído).',
  rate_limited: 'Muitas chamadas à Meta agora — tente novamente em instantes.',
  unknown: 'Falha ao buscar dados da Meta.',
}

export type DrillState = { status: 'loading' } | { status: 'error'; error: DrillDownError } | { status: 'loaded'; rows: DrillDownRow[] }

export const TOTAL_COLUMNS = 13

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

export type CampaignRow = {
  id: string
  name: string
  color: string | null
  status: string
  objective_group: ObjectiveGroup
  provider: string
  account_name: string
  ad_account_id?: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  cpl_cents: number | null
  cpm_cents: number | null
  ctr: number
  meta_messaging_started: number
  meta_purchases: number
  meta_purchase_value_cents: number
  cost_per_conversation_cents: number | null
  won_deals: number
  cac_cents: number | null
  roas: number | null
}

/** Métrica de conversão "certa" pra cada objetivo — segue o objetivo real
 * da campanha (mesmo conjunto de anúncios): Mensagens mostra conversas
 * iniciadas, Vendas mostra compras, os demais mostram leads/CPL (atribuição
 * via utm_campaign). */
export function ConversionCell({ row }: { row: CampaignRow }) {
  if (row.objective_group === 'messaging') {
    return (
      <div className="text-right">
        <div className="tabular-nums font-medium">{fmtNumber(row.meta_messaging_started)} conversas</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {row.cost_per_conversation_cents != null ? `${fmtCurrency(row.cost_per_conversation_cents)}/conversa` : '—'}
        </div>
      </div>
    )
  }
  if (row.objective_group === 'sales') {
    const costPerPurchase = row.meta_purchases > 0 ? Math.round(row.spend_cents / row.meta_purchases) : null
    return (
      <div className="text-right">
        <div className="tabular-nums font-medium">{fmtNumber(row.meta_purchases)} vendas</div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {costPerPurchase != null ? `${fmtCurrency(costPerPurchase)}/venda` : '—'}
        </div>
      </div>
    )
  }
  return (
    <div className="text-right">
      <div className="tabular-nums font-medium">{fmtNumber(row.leads)} leads</div>
      <div className="text-xs text-muted-foreground tabular-nums">
        {row.cpl_cents != null ? `${fmtCurrency(row.cpl_cents)}/lead` : '—'}
      </div>
    </div>
  )
}

export function DrillDownStatusBadge({ status }: { status: string }) {
  const active = status === 'active'
  const paused = status === 'paused'
  return (
    <Badge
      className={
        active
          ? 'bg-green-100 text-green-700 border-green-200'
          : paused
            ? 'bg-amber-100 text-amber-700 border-amber-200'
            : 'bg-muted text-muted-foreground'
      }
    >
      {active ? 'Ativo' : paused ? 'Pausado' : status || '—'}
    </Badge>
  )
}

/** Uma linha de CJ ou de Anúncio — mesmo layout de colunas da campanha,
 * mas sem CAC/ROAS (atribuição só existe em nível de campanha). O objetivo
 * é herdado da campanha (Meta não tem objetivo por CJ/anúncio), então a
 * métrica de conversão segue o mesmo objectiveGroup do ConversionCell. */
export function DrillDownRowView({
  row,
  depth,
  expandable,
  expanded,
  onToggle,
  objectiveGroup,
}: {
  row: DrillDownRow
  depth: number
  expandable: boolean
  expanded?: boolean
  onToggle?: () => void
  objectiveGroup: ObjectiveGroup
}) {
  return (
    <TableRow className="bg-muted/30 hover:bg-muted/50">
      <TableCell />
      <TableCell>
        <div className="flex items-center gap-2" style={{ paddingLeft: depth * 20 }}>
          {expandable ? (
            <button
              type="button"
              onClick={onToggle}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={expanded ? 'Recolher' : 'Expandir'}
            >
              <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-90' : ''}`} />
            </button>
          ) : (
            <span className="w-3.5 shrink-0" />
          )}
          <span className="text-sm text-muted-foreground truncate">{row.name}</span>
        </div>
      </TableCell>
      <TableCell />
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmtCurrency(row.spend_cents)}</TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmtNumber(row.impressions)}</TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {row.impressions > 0 ? fmtCurrency(Math.round((row.spend_cents / row.impressions) * 1000)) : '—'}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{fmtNumber(row.clicks)}</TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">{row.ctr.toFixed(2)}%</TableCell>
      <TableCell>
        {objectiveGroup === 'messaging' ? (
          <div className="text-right">
            <div className="tabular-nums text-sm text-muted-foreground">{fmtNumber(row.meta_messaging_started)} conversas</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {row.cost_per_conversation_cents != null ? `${fmtCurrency(row.cost_per_conversation_cents)}/conversa` : '—'}
            </div>
          </div>
        ) : objectiveGroup === 'sales' ? (
          <div className="text-right">
            <div className="tabular-nums text-sm text-muted-foreground">{fmtNumber(row.meta_purchases)} vendas</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {row.meta_purchases > 0 ? `${fmtCurrency(Math.round(row.spend_cents / row.meta_purchases))}/venda` : '—'}
            </div>
          </div>
        ) : (
          <div className="text-right">
            <div className="tabular-nums text-sm text-muted-foreground">{fmtNumber(row.meta_leads)} leads</div>
            <div className="text-xs text-muted-foreground tabular-nums">
              {row.meta_cpl_cents != null ? `${fmtCurrency(row.meta_cpl_cents)}/lead` : '—'}
            </div>
          </div>
        )}
      </TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
      <TableCell className="text-right text-sm text-muted-foreground">—</TableCell>
      <TableCell><DrillDownStatusBadge status={row.status} /></TableCell>
      <TableCell />
    </TableRow>
  )
}

export function DrillDownLoadingRow({ depth }: { depth: number }) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={TOTAL_COLUMNS}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" style={{ paddingLeft: depth * 20 }}>
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando na Meta…
        </div>
      </TableCell>
    </TableRow>
  )
}

export function DrillDownErrorRow({ depth, error, onRetry }: { depth: number; error: DrillDownError; onRetry: () => void }) {
  return (
    <TableRow className="bg-muted/30">
      <TableCell colSpan={TOTAL_COLUMNS}>
        <div className="flex items-center gap-2 text-xs text-destructive" style={{ paddingLeft: depth * 20 }}>
          <span>{DRILL_DOWN_ERROR_LABEL[error]}</span>
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline">
            <RotateCcw className="w-3 h-3" /> Tentar novamente
          </button>
        </div>
      </TableCell>
    </TableRow>
  )
}
