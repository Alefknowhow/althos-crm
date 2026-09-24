import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listEventsForRange } from '@/actions/events'
import { listOrgMembers } from '@/actions/team'
import { PageHeader } from '@/components/ui/page-header'
import CalendarView from '@/components/features/agenda/calendario/CalendarView'
import { rangeForView } from '@/components/features/agenda/calendario/CalendarShared'

export const dynamic = 'force-dynamic'

// Agenda → Calendário (issue #14) — Events, distinto de Tasks e de
// Agendamentos (booking público, que continua em /agendamentos).
export default async function CalendarioPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  const [members, initialEvents] = await Promise.all([
    listOrgMembers(params.orgSlug),
    listEventsForRange(params.orgSlug, rangeForView('month', new Date())),
  ])

  return (
    <div className="pt-3 space-y-6">
      <PageHeader title="Calendário" hint="Compromissos e eventos da equipe — mês, semana e dia." />
      <CalendarView orgSlug={params.orgSlug} initialEvents={initialEvents} members={members} niche={org.niche} />
    </div>
  )
}
