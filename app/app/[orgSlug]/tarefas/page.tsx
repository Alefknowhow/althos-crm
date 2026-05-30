import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import TaskDialog from '@/components/features/TaskDialog'
import TasksBoard from '@/components/features/tasks/TasksBoard'

export default async function TasksPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  // Pull every active-workflow task; the board splits them into columns
  // (A Fazer / Em Andamento / Concluído) and filters client-side.
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, description, status, priority, due_date, leads(id, name)')
    .eq('organization_id', org.id)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  // Supabase types the joined `leads` as an array; normalise to a single object.
  const normalized = (tasks || []).map((t: any) => ({
    ...t,
    leads: Array.isArray(t.leads) ? (t.leads[0] ?? null) : (t.leads ?? null),
  }))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-sm text-muted-foreground">Organize seu trabalho em quadro Kanban ou lista.</p>
        </div>
        <TaskDialog orgSlug={params.orgSlug} />
      </div>

      <TasksBoard initialTasks={normalized as any} orgSlug={params.orgSlug} />
    </div>
  )
}
