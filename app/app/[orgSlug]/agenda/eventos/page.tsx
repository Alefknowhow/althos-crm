import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { listEventsForRange } from '@/actions/events'
import { listOrgMembers } from '@/actions/team'
import { PageHeader } from '@/components/ui/page-header'
import EventsView from '@/components/features/agenda/eventos/EventsView'
import { rangeForView } from '@/components/features/agenda/eventos/EventsShared'

export const dynamic = 'force-dynamic'

// Agenda → Eventos (issue #14) — compromissos com horário marcado,
// isolados de Tasks (Tarefas não aparece aqui) e de Agendamentos (booking
// público, que continua em /agendamentos).
export default async function EventosPage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  const [members, initialEvents, taskPerm] = await Promise.all([
    listOrgMembers(params.orgSlug),
    listEventsForRange(params.orgSlug, rangeForView('month', new Date())),
    checkMemberPermission(org.id, user.id, 'tasks'),
  ])

  return (
    <div className="pt-3 space-y-6">
      <PageHeader title="Eventos" hint="Compromissos da equipe com horário marcado — mês, semana e dia." />
      <EventsView orgSlug={params.orgSlug} initialEvents={initialEvents} members={members} niche={org.niche} canCreateTasks={taskPerm.allowed} />
    </div>
  )
}
