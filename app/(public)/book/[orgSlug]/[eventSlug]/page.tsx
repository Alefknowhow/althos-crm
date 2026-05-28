import { notFound } from 'next/navigation'
import { resolvePublicEventType } from '@/actions/appointments'
import BookingClient from './BookingClient'

export const dynamic = 'force-dynamic'

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
