'use client'

/**
 * Tabela de campanhas do Portal com drill-down Meta (#27/#61 2.2) — clicar
 * numa campanha expande os Conjuntos de Anúncios, buscados ao vivo na Meta
 * sob demanda (nunca no carregamento inicial da página). Campanhas de
 * conta Google (sem integração viva) simplesmente não expandem.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, cn } from '@/lib/utils'
import { listPortalCampaignChildren } from '@/actions/client-portal-data'
import type { PortalCampaign } from '@/actions/client-portal-data'

const CAMPAIGN_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-green-100 text-green-800 border-green-200' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivada', className: 'bg-muted text-muted-foreground' },
}

const ERROR_LABEL: Record<string, string> = {
  token_expired: 'Dados detalhados indisponíveis no momento.',
  not_found: 'Campanha não encontrada.',
  rate_limited: 'Muitas consultas — tente novamente em instantes.',
  not_traffic_client: 'Detalhamento disponível só para contas Meta.',
  unknown: 'Não foi possível carregar o detalhamento agora.',
}

type ChildRow = { id: string; name: string; status: string; spend_cents: number; meta_leads: number; impressions: number; clicks: number }

export default function PortalCampaignsTable({ contatoId, campaigns }: { contatoId: string; campaigns: PortalCampaign[] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [children, setChildren] = useState<Record<string, ChildRow[] | { error: string }>>({})
  const [loading, setLoading] = useState<string | null>(null)

  async function toggle(campaignId: string) {
    if (expanded === campaignId) { setExpanded(null); return }
    setExpanded(campaignId)
    if (!children[campaignId]) {
      setLoading(campaignId)
      const res = await listPortalCampaignChildren(contatoId, campaignId)
      setChildren(prev => ({ ...prev, [campaignId]: res.ok ? res.rows : { error: ERROR_LABEL[res.error] || ERROR_LABEL.unknown } }))
      setLoading(null)
    }
  }

  if (campaigns.length === 0) {
    return <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma campanha nesse período.</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
            <th className="py-2 pr-3 font-medium" />
            <th className="py-2 pr-3 font-medium">Campanha</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 pr-3 font-medium text-right">Investimento</th>
            <th className="py-2 pr-3 font-medium text-right">Leads</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {campaigns.map(c => {
            const status = CAMPAIGN_STATUS_LABEL[c.status] || CAMPAIGN_STATUS_LABEL.active
            const isOpen = expanded === c.id
            const child = children[c.id]
            return (
              <>
                <tr key={c.id} className="cursor-pointer hover:bg-muted/40" onClick={() => toggle(c.id)}>
                  <td className="py-2 pl-1 w-6 text-muted-foreground">
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  </td>
                  <td className="py-2 pr-3">
                    <div className="font-medium truncate max-w-[220px]">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.ad_accounts?.name || '—'}</div>
                  </td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={status.className}>{status.label}</Badge></td>
                  <td className="py-2 pr-3 text-right tabular-nums font-medium">{formatCurrency(c.metrics.spend_cents)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{c.metrics.leads || '—'}</td>
                </tr>
                {isOpen && (
                  <tr key={`${c.id}-detail`}>
                    <td colSpan={5} className="bg-muted/20 px-4 py-3">
                      {loading === c.id && <p className="text-xs text-muted-foreground">Carregando conjuntos de anúncios…</p>}
                      {child && 'error' in child && <p className="text-xs text-muted-foreground">{child.error}</p>}
                      {child && Array.isArray(child) && (
                        child.length === 0 ? (
                          <p className="text-xs text-muted-foreground">Nenhum conjunto de anúncios encontrado.</p>
                        ) : (
                          <div className="space-y-1.5">
                            {child.map(as => (
                              <div key={as.id} className={cn('flex items-center justify-between text-xs rounded border bg-background px-2.5 py-1.5')}>
                                <span className="font-medium truncate max-w-[200px]">{as.name}</span>
                                <span className="flex items-center gap-3 text-muted-foreground">
                                  <span>{formatCurrency(as.spend_cents)}</span>
                                  <span>{as.meta_leads} leads</span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
