import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import Link from 'next/link'

export default async function TasksPage({ params, searchParams }: { params: { orgSlug: string }, searchParams: { tab?: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  
  const tab = searchParams.tab || 'today'
  
  let query = supabase.from('tasks').select('*, leads(id, name)').eq('organization_id', org.id).order('due_date', { ascending: true })
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  if (tab === 'today') {
    query = query.eq('status', 'open').lt('due_date', tomorrow.toISOString()).gte('due_date', today.toISOString())
  } else if (tab === 'week') {
    query = query.eq('status', 'open').gte('due_date', today.toISOString()).lt('due_date', nextWeek.toISOString())
  } else if (tab === 'overdue') {
    query = query.eq('status', 'open').lt('due_date', today.toISOString())
  } else if (tab === 'done') {
    query = query.eq('status', 'done').order('updated_at', { ascending: false })
  } else if (tab === 'all') {
    query = query.eq('status', 'open')
  }

  const { data: tasks } = await query

  const tabs = [
    { id: 'today', name: 'Hoje' },
    { id: 'week', name: 'Esta Semana' },
    { id: 'overdue', name: 'Atrasadas' },
    { id: 'all', name: 'Todas (Abertas)' },
    { id: 'done', name: 'Concluídas' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Tarefas</h1>
        <TaskDialog orgSlug={params.orgSlug} />
      </div>

      <div className="flex gap-4 border-b overflow-x-auto hide-scrollbar">
        {tabs.map(t => (
          <Link key={t.id} href={`/app/${params.orgSlug}/tarefas?tab=${t.id}`} className={`pb-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t.name}
          </Link>
        ))}
      </div>

      <div className="space-y-3">
        {tasks && tasks.length > 0 ? (
          tasks.map(task => <TaskCard key={task.id} task={task} orgSlug={params.orgSlug} />)
        ) : (
          <div className="p-12 text-center border-2 border-dashed rounded-xl text-muted-foreground bg-muted/10">Nenhuma tarefa encontrada nesta visão.</div>
        )}
      </div>
    </div>
  )
}
