'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Megaphone, TrendingUp, TrendingDown } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'

type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number; leads: number }
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-green-100 text-green-800 border-green-200' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivada', className: 'bg-muted text-muted-foreground' },
}

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'active', label: 'Ativas' },
  { key: 'paused', label: 'Pausadas' },
] as const

export default function ClientCampaignsTable({ campaigns }: { campaigns: CampaignRow[] }) {
  const [filter, setFilter] = useState<typeof FILTERS[number]['key']>('all')

  const filtered = useMemo(
    () => filter === 'all' ? campaigns : campaigns.filter(c => c.status === filter),
    [campaigns, filter],
  )

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4" /> Campanhas</CardTitle>
        <div className="flex items-center gap-1 rounded-md border p-0.5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'px-2.5 py-1 text-xs rounded-sm font-medium transition-colors',
                filter === f.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Nenhuma campanha nesse filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">Campanha</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 pr-3 font-medium text-right">Investimento</th>
                  <th className="py-2 pr-3 font-medium text-right">Impressões</th>
                  <th className="py-2 pr-3 font-medium text-right">Cliques</th>
                  <th className="py-2 pr-3 font-medium text-right">CTR</th>
                  <th className="py-2 pr-3 font-medium text-right">Leads</th>
                  <th className="py-2 pr-3 font-medium text-right">CPL</th>
                  <th className="py-2 pl-0 font-medium text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(c => {
                  const status = STATUS_LABEL[c.status] || STATUS_LABEL.active
                  const ctr = c.metrics.impressions > 0 ? (c.metrics.clicks / c.metrics.impressions) * 100 : null
                  const cpl = c.metrics.leads > 0 ? c.metrics.spend_cents / c.metrics.leads : null
                  return (
                    <tr key={c.id}>
                      <td className="py-2.5 pr-3">
                        <div className="font-medium truncate max-w-[220px]">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.ad_accounts?.name || '—'} · {c.objective || '—'}</div>
                      </td>
                      <td className="py-2.5 pr-3"><Badge variant="outline" className={status.className}>{status.label}</Badge></td>
                      <td className="py-2.5 pr-3 text-right tabular-nums font-medium">{formatCurrency(c.metrics.spend_cents)}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.metrics.impressions.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.metrics.clicks.toLocaleString('pt-BR')}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{ctr != null ? `${ctr.toFixed(2)}%` : '—'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{c.metrics.leads || '—'}</td>
                      <td className="py-2.5 pr-3 text-right tabular-nums">{cpl != null ? formatCurrency(cpl) : '—'}</td>
                      <td className="py-2.5 pl-0 text-right">
                        <Button size="sm" variant="ghost" disabled title="Diagnóstico por IA — em breve" className="text-xs">
                          Diagnosticar
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
