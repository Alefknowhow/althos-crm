import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { listTaskColumns } from '@/actions/tasks'
import TaskDialog from '@/components/features/TaskDialog'
import TasksBoard from '@/components/features/tasks/TasksBoard'
import { PageHeader } from '@/components/ui/page-header'

export default async function TasksPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  // Pull every active-workflow task; the board groups them by custom column
  // and filters client-side. Columns are user-defined (pipeline-style).
  const [{ data: tasks }, members, columnsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, column_id, leads:contatos(id, name)')
      .eq('organization_id', org.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false }),
    listOrgMembers(params.orgSlug),
    listTaskColumns(params.orgSlug),
  ])

  const columns = columnsRes.ok ? columnsRes.columns : []

  const memberName = new Map(members.map(m => [m.user_id, m.name]))

  // Supabase types the joined `leads` as an array; normalise to a single object.
  const normalized = (tasks || []).map((t: any) => ({
    ...t,
    leads: Array.isArray(t.leads) ? (t.leads[0] ?? null) : (t.leads ?? null),
    assignee_name: t.assigned_to ? (memberName.get(t.assigned_to) ?? null) : null,
  }))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tarefas"
        hint="Organize seu trabalho em quadro Kanban ou lista."
        actions={<TaskDialog orgSlug={params.orgSlug} members={members} />}
      />

      <TasksBoard
        initialTasks={normalized as any}
        initialColumns={columns}
        orgSlug={params.orgSlug}
        members={members}
      />
    </div>
  )
}
