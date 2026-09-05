'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import TrackingLinksManager from './TrackingLinksManager'
import ClientFunnelCard from './ClientFunnelCard'
import type { TrackingLink } from '@/actions/tracking-links'
import type { ClientTrackingFunnel, ConvertedLead, LinkPerformance } from '@/actions/trafego-tracking'

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
      <ClientFunnelCard funnel={funnel} hasData={hasData} />

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
