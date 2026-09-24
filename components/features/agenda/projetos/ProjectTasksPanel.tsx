'use client'

/** Lista de Tasks de um Projeto — gestão completa (editar/excluir), não só
 *  concluir (issue #17: "gerenciar as tasks por ali mesmo, com opção de
 *  excluir"). Reaproveita o EditSheet real de Tarefas (mesmo registro —
 *  editar aqui reflete em Agenda → Tarefas e vice-versa). */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/features/ActionButton'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import TaskDialog from '@/components/features/TaskDialog'
import { EditSheet } from '@/components/features/tasks/TasksBoardTaskViews'
import { toggleTaskStatus, deleteTask } from '@/actions/tasks'
import { createProjectGroup, renameProjectGroup, deleteProjectGroup } from '@/actions/projects'
import type { Task } from '@/components/features/tasks/TasksBoardShared'

type Group = { id: string; name: string; position: number }
type Member = { user_id: string; name: string; email: string }

interface Props {
  orgSlug: string
  projectId: string
  clientId: string | null
  clientName: string
  groups: Group[]
  tasks: Task[]
  members: Member[]
}

function TaskRow({ orgSlug, task, onEdit, onDelete }: { orgSlug: string; task: Task; onEdit: () => void; onDelete: () => void }) {
  const router = useRouter()
  const [done, setDone] = useState(task.status === 'done')

  async function toggle() {
    const next = !done
    setDone(next)
    const res = await toggleTaskStatus(orgSlug, task.id, next ? 'done' : 'open')
    if (!(res as any).ok) { setDone(!next); toast.error('Erro ao atualizar tarefa'); return }
    router.refresh()
  }

  const isOverdue = task.due_date && !done && task.due_date.split('T')[0] < new Date().toISOString().split('T')[0]
  const priorityLabel: Record<string, string> = { low: 'Baixa', normal: 'Média', high: 'Alta' }

  return (
    <div className="group flex items-center gap-3 py-2 px-1 border-b last:border-0">
      <input type="checkbox" className="w-4 h-4 accent-primary cursor-pointer" checked={done} onChange={toggle} />
      <button type="button" onClick={onEdit} className="flex-1 min-w-0 text-left">
        <span className={`block text-sm truncate ${done ? 'line-through text-muted-foreground' : ''}`}>{task.title}</span>
      </button>
      {task.due_date && (
        <span className={`text-xs whitespace-nowrap ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}
        </span>
      )}
      <Badge variant="outline" className="text-[10px] px-1 h-4 hidden sm:inline-flex">{priorityLabel[task.priority] || task.priority}</Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações da tarefa"
            className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={onEdit}><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
          <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

export default function ProjectTasksPanel({ orgSlug, projectId, clientId, clientName, groups, tasks, members }: Props) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [newGroupOpen, setNewGroupOpen] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [taskDialogGroupId, setTaskDialogGroupId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  const tasksByGroup = new Map<string | null, Task[]>()
  for (const t of tasks) {
    const key = t.project_group_id ?? null
    const arr = tasksByGroup.get(key) || []
    arr.push(t)
    tasksByGroup.set(key, arr)
  }
  const ungrouped = tasksByGroup.get(null) || []

  function addGroup() {
    if (!newGroupName.trim()) return
    startTrans(async () => {
      const res = await createProjectGroup(orgSlug, projectId, newGroupName.trim())
      if (!res.ok) { toast.error(res.error || 'Erro ao criar grupo'); return }
      setNewGroupName('')
      setNewGroupOpen(false)
      router.refresh()
    })
  }

  function renameGroup(id: string, current: string) {
    const name = prompt('Renomear grupo', current)
    if (!name || name === current) return
    startTrans(async () => {
      const res = await renameProjectGroup(orgSlug, id, name)
      if (!res.ok) toast.error(res.error || 'Erro ao renomear grupo')
      router.refresh()
    })
  }

  function removeGroup(id: string, name: string) {
    if (!confirm(`Excluir o grupo "${name}"? As tarefas dele continuam existindo, só ficam sem grupo.`)) return
    startTrans(async () => {
      const res = await deleteProjectGroup(orgSlug, id)
      if (!res.ok) toast.error(res.error || 'Erro ao excluir grupo')
      router.refresh()
    })
  }

  function handleDeleteTask(id: string) {
    if (!confirm('Excluir esta tarefa? Não pode ser desfeito.')) return
    startTrans(async () => {
      const res = await deleteTask(orgSlug, id)
      if (!res.ok) { toast.error('Erro ao excluir tarefa'); return }
      toast.success('Tarefa excluída')
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-muted-foreground">Tarefas do projeto</h3>
        <div className="flex gap-2">
          {newGroupOpen ? (
            <div className="flex items-center gap-1">
              <Input
                autoFocus value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                placeholder="Nome do grupo" className="h-8 w-40"
                onKeyDown={e => { if (e.key === 'Enter') addGroup(); if (e.key === 'Escape') setNewGroupOpen(false) }}
              />
              <Button size="sm" className="h-8" onClick={addGroup}>Adicionar</Button>
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setNewGroupOpen(true)}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Grupo
            </Button>
          )}
          <ActionButton size="sm" onClick={() => { setTaskDialogGroupId(null); setDialogOpen(true) }}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
          </ActionButton>
        </div>
      </div>

      {groups.map(group => {
        const groupTasks = tasksByGroup.get(group.id) || []
        const doneCount = groupTasks.filter(t => t.status === 'done').length
        return (
          <div key={group.id} className="rounded-lg border">
            <div className="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-t-lg">
              <div className="text-sm font-medium">
                {group.name} <span className="text-xs text-muted-foreground font-normal ml-1">{doneCount}/{groupTasks.length}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setTaskDialogGroupId(group.id); setDialogOpen(true) }}>
                  <Plus className="w-3 h-3 mr-1" /> Tarefa
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-3.5 h-3.5" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => renameGroup(group.id, group.name)}><Pencil className="w-3.5 h-3.5 mr-2" /> Renomear</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => removeGroup(group.id, group.name)} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir grupo</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="px-3">
              {groupTasks.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3">Nenhuma tarefa neste grupo ainda.</div>
              ) : (
                groupTasks.map(t => <TaskRow key={t.id} orgSlug={orgSlug} task={t} onEdit={() => setEditing(t)} onDelete={() => handleDeleteTask(t.id)} />)
              )}
            </div>
          </div>
        )
      })}

      <div className="rounded-lg border">
        <div className="px-3 py-2 bg-muted/30 rounded-t-lg text-sm font-medium">
          Sem grupo <span className="text-xs text-muted-foreground font-normal ml-1">{ungrouped.filter(t => t.status === 'done').length}/{ungrouped.length}</span>
        </div>
        <div className="px-3">
          {ungrouped.length === 0 ? (
            <div className="text-xs text-muted-foreground py-3">Todas as tarefas estão organizadas em grupos.</div>
          ) : (
            ungrouped.map(t => <TaskRow key={t.id} orgSlug={orgSlug} task={t} onEdit={() => setEditing(t)} onDelete={() => handleDeleteTask(t.id)} />)
          )}
        </div>
      </div>

      {/* TaskDialog/EditSheet reais do módulo Tarefas (components/features/tasks/) —
          sem lógica paralela. Cliente e projeto vêm pré-preenchidos na criação;
          grupo é o que o botão que abriu o diálogo definiu. */}
      <TaskDialog
        orgSlug={orgSlug}
        defaultLead={clientId ? { id: clientId, name: clientName } : null}
        members={members}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projectId={projectId}
        projectGroupId={taskDialogGroupId}
        trigger={<span />}
      />

      <EditSheet
        task={editing}
        orgSlug={orgSlug}
        members={members}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); router.refresh() }}
        onDelete={handleDeleteTask}
      />
    </div>
  )
}
