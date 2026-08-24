'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown, Waypoints } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import TrackingLinksManager from './TrackingLinksManager'
import type { TrackingLink } from '@/actions/tracking-links'
import type { ClientTrackingFunnel, ConvertedLead, LinkPerformance } from '@/actions/trafego-tracking'

const STEPS: { key: keyof ClientTrackingFunnel; label: string; format: 'currency' | 'number' }[] = [
  { key: 'investmentCents', label: 'Investimento', format: 'currency' },
  { key: 'clicks', label: 'Cliques', format: 'number' },
  { key: 'leads', label: 'Leads', format: 'number' },
  { key: 'sales', label: 'Vendas', format: 'number' },
  { key: 'revenueCents', label: 'Receita', format: 'currency' },
]

function fmt(value: number, format: 'currency' | 'number'): string {
  return format === 'currency' ? formatCurrency(value) : value.toLocaleString('pt-BR')
}

/**
 * Aba Tracking — sistema de rastreamento próprio (Fase 1). Funil real
 * (investimento → cliques → leads → vendas → receita) a partir de
 * tracking_links/tracking_clicks deste cliente, mais gerenciamento dos
 * links e a jornada multi-touch de cada lead convertido.
 */
export default function ClientTrackingTab({
  orgSlug, clientId, funnel, journeys, initialLinks, linkPerformance,
}: {
  orgSlug: string
  clientId: string
  funnel: ClientTrackingFunnel
  journeys: ConvertedLead[]
  initialLinks: TrackingLink[]
  linkPerformance: LinkPerformance[]
}) {
  const hasData = funnel.clicks > 0 || initialLinks.length > 0

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Funil (30 dias)</CardTitle></CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="py-8 text-center space-y-2">
              <Waypoints className="w-8 h-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Nenhum link de rastreamento criado ainda.</p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Crie um link abaixo e use ele nos anúncios desse cliente — o funil aparece aqui assim que os primeiros cliques chegarem.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-stretch gap-2">
                {STEPS.map((s, i) => (
                  <div key={s.key} className="flex items-center gap-2">
                    <div className="rounded-lg border bg-background px-4 py-3 min-w-[110px]">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{s.label}</div>
                      <div className="text-lg font-bold tabular-nums">{fmt(funnel[s.key] as number, s.format)}</div>
                    </div>
                    {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPL</div>
                  <div className="font-semibold tabular-nums">{funnel.cplCents != null ? formatCurrency(funnel.cplCents) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">CPA</div>
                  <div className="font-semibold tabular-nums">{funnel.cpaCents != null ? formatCurrency(funnel.cpaCents) : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">ROAS</div>
                  <div className="font-semibold tabular-nums">{funnel.roas != null ? `${funnel.roas.toFixed(1)}x` : '—'}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Clique → Lead</div>
                  <div className="font-semibold tabular-nums">{funnel.clickToLeadPct != null ? `${funnel.clickToLeadPct.toFixed(1)}%` : '—'}</div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {journeys.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Jornada dos leads convertidos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {journeys.map(j => <JourneyRow key={j.contatoId} journey={j} />)}
          </CardContent>
        </Card>
      )}

      <TrackingLinksManager orgSlug={orgSlug} clientId={clientId} initial={initialLinks} performance={linkPerformance} />
    </div>
  )
}

function JourneyRow({ journey }: { journey: ConvertedLead }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border rounded-md">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-left"
      >
        <span className="font-medium">{journey.name}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {journey.journey.length} toque{journey.journey.length !== 1 ? 's' : ''}
          <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1.5 border-t pt-2">
          {journey.journey.map((step, i) => (
            <div key={step.clickId} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="shrink-0">{i + 1}</Badge>
              <span className="text-muted-foreground">{new Date(step.createdAt).toLocaleString('pt-BR')}</span>
              <span>{step.linkLabel || `/r/${step.linkCode}`}</span>
              {step.utmSource && <span className="text-muted-foreground">· {step.utmSource}{step.utmCampaign ? `/${step.utmCampaign}` : ''}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
