'use client'

/**
 * Visão Geral do Portal (#27/#61, passo 2.1) — período e plataforma
 * selecionáveis, reaproveitando o mesmo chart do painel interno
 * (ClientPerformanceChart é um client component puro, sem chamadas
 * próprias de action). A troca de período/plataforma dispara uma nova
 * chamada de server action e re-renderiza só este bloco, sem recarregar
 * a página inteira.
 */

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { getPortalOverview, getPortalDailySeries, type PortalOverviewPlatform } from '@/actions/client-portal'
import type { ClientPerformanceSummary, ClientDailyPoint } from '@/actions/trafego-performance'
import ClientPerformanceChart from '@/components/features/agencias-trafego/ClientPerformanceChart'

const PERIOD_OPTIONS: { days: 7 | 30 | 90; label: string }[] = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
]

export default function PortalOverviewTab({
  contatoId,
  initial,
  initialSeries,
  availablePlatforms,
}: {
  contatoId: string
  initial: { current: ClientPerformanceSummary; previous: ClientPerformanceSummary }
  initialSeries: ClientDailyPoint[]
  availablePlatforms: string[]
}) {
  const [days, setDays] = useState<7 | 30 | 90>(30)
  const [platform, setPlatform] = useState<PortalOverviewPlatform>('all')
  const [data, setData] = useState(initial)
  const [series, setSeries] = useState(initialSeries)
  const [isPending, startTransition] = useTransition()

  const showPlatformFilter = availablePlatforms.length > 1

  useEffect(() => {
    if (days === 30 && platform === 'all') return
    startTransition(async () => {
      const [overview, dailySeries] = await Promise.all([
        getPortalOverview(contatoId, { days, platform }),
        getPortalDailySeries(contatoId, { days, platform }),
      ])
      setData(overview)
      setSeries(dailySeries)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, platform, contatoId])

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {PERIOD_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setDays(opt.days)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-sm font-medium transition-colors',
                  days === opt.days ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {showPlatformFilter && (
            <div className="flex items-center gap-1 rounded-md border p-0.5">
              {(['all', ...availablePlatforms] as PortalOverviewPlatform[]).map(p => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={cn(
                    'px-2.5 py-1 text-xs rounded-sm font-medium capitalize transition-colors',
                    platform === p ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary',
                  )}
                >
                  {p === 'all' ? 'Todas' : p}
                </button>
              ))}
            </div>
          )}
          {isPending && <span className="text-xs text-muted-foreground">Atualizando…</span>}
        </CardContent>
      </Card>

      <ClientPerformanceChart current={data.current} previous={data.previous} series={series} />
    </div>
  )
}
