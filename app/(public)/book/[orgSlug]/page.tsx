import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Clock, MapPin, CalendarDays, ChevronRight } from 'lucide-react'
import { resolvePublicOrgEventTypes } from '@/actions/appointments'

export const dynamic = 'force-dynamic'

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

export default async function OrgBookingPage({
  params,
}: {
  params: { orgSlug: string }
}) {
  const { org, eventTypes } = await resolvePublicOrgEventTypes(params.orgSlug)
  if (!org) notFound()

  return (
    <div className="min-h-screen bg-background py-10 px-4 sm:py-16">
      <div className="mx-auto w-full max-w-2xl">
        {/* Header */}
        <div className="text-center space-y-2 mb-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-none bg-primary/10 text-primary">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
          <p className="text-sm text-muted-foreground">
            Escolha o tipo de agendamento para ver os horários disponíveis.
          </p>
        </div>

        {/* Event types */}
        {eventTypes.length === 0 ? (
          <div className="rounded-none border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
            Nenhum tipo de agendamento disponível no momento.
          </div>
        ) : (
          <div className="space-y-3">
            {eventTypes.map(et => (
              <Link
                key={et.id}
                href={`/book/${params.orgSlug}/${et.slug}`}
                className="group flex items-center gap-4 rounded-none border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-accent/40"
              >
                <span
                  className="h-10 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: et.color || 'hsl(var(--primary))' }}
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="font-semibold leading-tight truncate">{et.name}</h2>
                  {et.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{et.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {durationLabel(et.duration_minutes)}
                    </span>
                    {et.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {et.location}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="mt-10 text-center text-xs text-muted-foreground">
          Powered by <span className="font-medium text-foreground/70">Althos CRM</span>
        </p>
      </div>
    </div>
  )
}
