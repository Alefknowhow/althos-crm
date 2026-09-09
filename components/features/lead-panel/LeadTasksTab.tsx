'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import TaskCard from '@/components/features/TaskCard'
import TaskDialog from '@/components/features/TaskDialog'
import { listTasksForContato } from '@/actions/tasks'

export default function LeadTasksTab({
  orgSlug, leadId, leadName, members = [],
}: {
  orgSlug: string
  leadId: string
  members?: { user_id: string; name: string; email: string }[]
  leadName: string
}) {
  const [tasks, setTasks] = useState<any[] | null>(null)
  const [newTaskOpen, setNewTaskOpen] = useState(false)

  const [revision, setRevision] = useState(0)
  const [error, setError] = useState(false)
  const defaultLead = useMemo(() => ({ id: leadId, name: leadName }), [leadId, leadName])
  const reload = () => setRevision(value => value + 1)

  useEffect(() => {
    let active = true
    setTasks(null)
    setError(false)
    listTasksForContato(orgSlug, leadId).then(data => {
      if (active) setTasks(data)
    }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [orgSlug, leadId, revision])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarefas</h4>
        <Button type="button" size="sm" variant="outline" onClick={() => setNewTaskOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">Registre aqui as próximas ações da negociação, com prazo e responsável.</p>
      {error ? (
        <Button variant="outline" size="sm" onClick={reload}>Não foi possível carregar. Tentar novamente</Button>
      ) : tasks === null ? (
        <div className="flex justify-center py-6 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
      ) : tasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma tarefa vinculada.</p>
      ) : (
        <div className="space-y-3">
          {tasks.map(task => <TaskCard key={task.id} task={{ ...task, leads: { id: leadId, name: leadName } }} orgSlug={orgSlug} onChanged={reload} />)}
        </div>
      )}

      <TaskDialog
        orgSlug={orgSlug}
        defaultLead={defaultLead}
        members={members}
        trigger={<button type="button" className="hidden" aria-hidden />}
        open={newTaskOpen}
        onOpenChange={(v: boolean) => { setNewTaskOpen(v); if (!v) reload() }}
      />
    </div>
  )
}
