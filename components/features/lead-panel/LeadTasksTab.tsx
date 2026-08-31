'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import { listTasksForContato } from '@/actions/tasks'

export default function LeadTasksTab({
  orgSlug, leadId, leadName,
}: {
  orgSlug: string
  leadId: string
  leadName: string
}) {
  const [tasks, setTasks] = useState<any[] | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  async function reload() {
    const data = await listTasksForContato(orgSlug, leadId)
    setTasks(data)
  }

  useEffect(() => {
    setTasks(null)
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, leadId])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarefas</h4>
        <Button type="button" size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
        </Button>
      </div>

      {tasks === null ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma tarefa vinculada.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => <TaskCard key={task.id} task={task} orgSlug={orgSlug} />)}
        </div>
      )}

      <TaskDialog
        orgSlug={orgSlug}
        defaultLead={{ id: leadId, name: leadName }}
        trigger={<button type="button" className="hidden" aria-hidden />}
        open={newTaskOpen}
        onOpenChange={(v: boolean) => { setNewTaskOpen(v); if (!v) reload() }}
      />
    </div>
  )
}
