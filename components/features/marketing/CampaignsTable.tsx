'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Pause, Play, Megaphone, ChevronRight, Loader2, RotateCcw } from 'lucide-react'
import { deleteCampaign, updateCampaign, getCampaignAdSets, getAdSetAds, type DrillDownRow, type DrillDownError } from '@/actions/marketing'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import ObjectiveBadge from './ObjectiveBadge'
import type { ObjectiveGroup } from '@/lib/marketing/objective'

type CampaignRow = {
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

const DRILL_DOWN_ERROR_LABEL: Record<DrillDownError, string> = {
  token_expired: 'Token da conta expirou — reconecte em Campanhas → Contas.',
  not_found: 'Não encontrado na Meta (pode ter sido excluído).',
  rate_limited: 'Muitas chamadas à Meta agora — tente novamente em instantes.',
  unknown: 'Falha ao buscar dados da Meta.',
}

type DrillState = { status: 'loading' } | { status: 'error'; error: DrillDownError } | { status: 'loaded'; rows: DrillDownRow[] }

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

/** Métrica de conversão "certa" pra cada objetivo — segue o objetivo real
 * da campanha (mesmo conjunto de anúncios): Mensagens mostra conversas
 * iniciadas, Vendas mostra compras, os demais mostram leads/CPL (atribuição
 * via utm_campaign). */
function ConversionCell({ row }: { row: CampaignRow }) {
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

const TOTAL_COLUMNS = 13

function DrillDownStatusBadge({ status }: { status: string }) {
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
function DrillDownRowView({
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

function DrillDownLoadingRow({ depth }: { depth: number }) {
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

function DrillDownErrorRow({ depth, error, onRetry }: { depth: number; error: DrillDownError; onRetry: () => void }) {
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

export default function CampaignsTable({
  orgSlug,
  rows,
  period,
  onRefresh,
  chartSelection,
  onToggleChartSelection,
}: {
  orgSlug: string
  rows: CampaignRow[]
  period: string
  onRefresh: () => void
  /** Quais campanhas aparecem no gráfico de evolução — 'all' = todas. */
  chartSelection?: Set<string> | 'all'
  onToggleChartSelection?: (campaignId: string) => void
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rowToDelete, setRowToDelete] = useState<CampaignRow | null>(null)

  // Drill-down: campanha → CJ → anúncio, tudo ao vivo, cacheado em estado
  // local (não refetcha ao recolher/reexpandir a mesma linha).
  const [expandedCampaigns, setExpandedCampaigns] = useState<Set<string>>(new Set())
  const [adSetsByCampaign, setAdSetsByCampaign] = useState<Map<string, DrillState>>(new Map())
  const [expandedAdSets, setExpandedAdSets] = useState<Set<string>>(new Set())
  const [adsByAdSet, setAdsByAdSet] = useState<Map<string, DrillState>>(new Map())

  async function loadAdSets(campaignId: string) {
    setAdSetsByCampaign(prev => new Map(prev).set(campaignId, { status: 'loading' }))
    const res = await getCampaignAdSets(orgSlug, campaignId, period as any)
    setAdSetsByCampaign(prev => new Map(prev).set(
      campaignId,
      res.ok ? { status: 'loaded', rows: res.rows } : { status: 'error', error: res.error },
    ))
  }

  function toggleCampaign(campaignId: string) {
    setExpandedCampaigns(prev => {
      const next = new Set(prev)
      if (next.has(campaignId)) {
        next.delete(campaignId)
      } else {
        next.add(campaignId)
        if (!adSetsByCampaign.has(campaignId)) loadAdSets(campaignId)
      }
      return next
    })
  }

  async function loadAds(adSetId: string) {
    setAdsByAdSet(prev => new Map(prev).set(adSetId, { status: 'loading' }))
    const res = await getAdSetAds(orgSlug, adSetId, period as any)
    setAdsByAdSet(prev => new Map(prev).set(
      adSetId,
      res.ok ? { status: 'loaded', rows: res.rows } : { status: 'error', error: res.error },
    ))
  }

  function toggleAdSet(adSetId: string) {
    setExpandedAdSets(prev => {
      const next = new Set(prev)
      if (next.has(adSetId)) {
        next.delete(adSetId)
      } else {
        next.add(adSetId)
        if (!adsByAdSet.has(adSetId)) loadAds(adSetId)
      }
      return next
    })
  }

  async function toggleStatus(row: CampaignRow) {
    setBusyId(row.id)
    const nextStatus = row.status === 'active' ? 'paused' : 'active'
    const res = await updateCampaign(orgSlug, row.id, { status: nextStatus })
    setBusyId(null)
    if (res.ok) {
      toast.success(nextStatus === 'active' ? 'Campanha ativada' : 'Campanha pausada')
      onRefresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(row: CampaignRow) {
    setBusyId(row.id)
    const res = await deleteCampaign(orgSlug, row.id)
    setBusyId(null)
    if (res.ok) {
      toast.success('Excluída')
      onRefresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Desempenho das campanhas</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {rows.length} campanha{rows.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <Megaphone className="w-10 h-10 mx-auto opacity-40" />
            <p>Nenhuma campanha cadastrada ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" title="No gráfico">Gráf.</TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Objetivo</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">CAC</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => {
                  const isExpanded = expandedCampaigns.has(r.id)
                  const adSetsState = adSetsByCampaign.get(r.id)
                  return (
                  <Fragment key={r.id}>
                  <TableRow>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={chartSelection === 'all' || !!chartSelection?.has(r.id)}
                        onChange={() => onToggleChartSelection?.(r.id)}
                        title="Mostrar esta campanha no gráfico de evolução"
                        aria-label={`Incluir ${r.name} no gráfico`}
                        className="h-3.5 w-3.5 accent-primary cursor-pointer"
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => toggleCampaign(r.id)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={isExpanded ? 'Recolher conjuntos de anúncios' : 'Expandir conjuntos de anúncios'}
                        >
                          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: r.color || '#3b82f6' }}
                        />
                        <div>
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.account_name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <ObjectiveBadge group={r.objective_group} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCurrency(r.spend_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtNumber(r.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.cpm_cents != null ? fmtCurrency(r.cpm_cents) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtNumber(r.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.ctr.toFixed(2)}%
                    </TableCell>
                    <TableCell>
                      <ConversionCell row={r} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.cac_cents != null ? fmtCurrency(r.cac_cents) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.roas != null ? `${r.roas.toFixed(2)}x` : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : r.status === 'paused'
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-muted text-muted-foreground'
                        }
                      >
                        {r.status === 'active' ? 'Ativa' : r.status === 'paused' ? 'Pausada' : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStatus(r)}
                          disabled={busyId === r.id}
                          title={r.status === 'active' ? 'Pausar' : 'Ativar'}
                        >
                          {r.status === 'active' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setRowToDelete(r)}
                          disabled={busyId === r.id}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {isExpanded && adSetsState?.status === 'loading' && <DrillDownLoadingRow depth={1} />}
                  {isExpanded && adSetsState?.status === 'error' && (
                    <DrillDownErrorRow depth={1} error={adSetsState.error} onRetry={() => loadAdSets(r.id)} />
                  )}
                  {isExpanded && adSetsState?.status === 'loaded' && adSetsState.rows.length === 0 && (
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={TOTAL_COLUMNS}>
                        <div className="text-xs text-muted-foreground" style={{ paddingLeft: 20 }}>Nenhum conjunto de anúncios encontrado.</div>
                      </TableCell>
                    </TableRow>
                  )}
                  {isExpanded && adSetsState?.status === 'loaded' && adSetsState.rows.map(as => {
                    const adSetExpanded = expandedAdSets.has(as.id)
                    const adsState = adsByAdSet.get(as.id)
                    return (
                      <Fragment key={as.id}>
                        <DrillDownRowView
                          row={as}
                          depth={1}
                          expandable
                          expanded={adSetExpanded}
                          onToggle={() => toggleAdSet(as.id)}
                          objectiveGroup={r.objective_group}
                        />
                        {adSetExpanded && adsState?.status === 'loading' && <DrillDownLoadingRow depth={2} />}
                        {adSetExpanded && adsState?.status === 'error' && (
                          <DrillDownErrorRow depth={2} error={adsState.error} onRetry={() => loadAds(as.id)} />
                        )}
                        {adSetExpanded && adsState?.status === 'loaded' && adsState.rows.length === 0 && (
                          <TableRow className="bg-muted/30">
                            <TableCell colSpan={TOTAL_COLUMNS}>
                              <div className="text-xs text-muted-foreground" style={{ paddingLeft: 40 }}>Nenhum anúncio encontrado.</div>
                            </TableCell>
                          </TableRow>
                        )}
                        {adSetExpanded && adsState?.status === 'loaded' && adsState.rows.map(ad => (
                          <DrillDownRowView key={ad.id} row={ad} depth={2} expandable={false} objectiveGroup={r.objective_group} />
                        ))}
                      </Fragment>
                    )
                  })}
                  </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!rowToDelete} onOpenChange={o => !o && setRowToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              {rowToDelete ? `Excluir "${rowToDelete.name}"? Métricas registradas serão removidas. ` : ''}Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(rowToDelete!); setRowToDelete(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
