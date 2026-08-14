import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import { listTaskColumns } from '@/actions/tasks'
import TaskDialog from '@/components/features/TaskDialog'
import TasksBoard from '@/components/features/tasks/TasksBoard'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from 'lucide-react'

export default async function TasksPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  // Pull every active-workflow task; the board groups them by custom column
  // and filters client-side. Columns are user-defined (pipeline-style).
  // Limit(1000) trava um teto — antes carregava a tabela inteira sem limite.
  const [{ data: tasks }, members, columnsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, column_id, leads:contatos(id, name)')
      .eq('organization_id', org.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1000),
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
        hint="Organize seu trabalho em quadro Kanban, lista ou calendário."
      />

      <TasksBoard
        initialTasks={normalized as any}
        initialColumns={columns}
        orgSlug={params.orgSlug}
        members={members}
        headerAction={<TaskDialog orgSlug={params.orgSlug} members={members} />}
      />

      {/* FAB mobile — mesma criação de tarefa do botão do cabeçalho (desktop),
          só que ancorada no canto inferior direito, acima da bottom nav. */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <TaskDialog
          orgSlug={params.orgSlug}
          members={members}
          trigger={
            <button
              type="button"
              aria-label="Nova tarefa"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          }
        />
      </div>
    </div>
  )
}
