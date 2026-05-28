import { createClient } from '@/lib/supabase/server'
import TasksToday from './TasksToday'

export default async function TasksTodayWidget({ orgId, orgSlug }: { orgId: string, orgSlug: string }) {
  const supabase = createClient()
  
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*, leads(id, name)')
    .eq('organization_id', orgId)
    .eq('status', 'open')
    .lt('due_date', tomorrow.toISOString())
    .order('due_date', { ascending: true })
    .limit(5)

  return <TasksToday tasks={tasks || []} orgSlug={orgSlug} />
}
