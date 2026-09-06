import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { resolvePublicEventType } from '@/actions/appointments'
import BookingClient from './BookingClient'

export const dynamic = 'force-dynamic'

// Página pública de agendamento (link compartilhável) — acessível por link,
// mas sem valor de descoberta em busca. robots.txt já bloqueia o rastreio
// (Disallow: /book/); isso aqui reforça via <meta name="robots"> pro caso de
// o link vazar por fora do rastreamento normal (ex.: agregador que ignora
// robots.txt).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function BookingPage({
  params,
}: {
  params: { orgSlug: string; eventSlug: string }
}) {
  const { org, eventType } = await resolvePublicEventType(params.orgSlug, params.eventSlug)
  if (!org || !eventType) notFound()

  return (
    <BookingClient
      orgSlug={params.orgSlug}
      orgName={org.name}
      eventSlug={params.eventSlug}
      eventType={eventType}
    />
  )
}
