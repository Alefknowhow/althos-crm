'use client'

/** Kanban interno de Tasks dentro de um Projeto (issue #17 §3-4) — colunas
 *  são o status REAL da Task (open/doing/done, já existe em tasks), não um
 *  schema novo. project_group_id vira um badge no card, não uma segunda
 *  dimensão de Kanban. dnd-kit, mesmo padrão de ProjectsBoard.tsx. Gestão
 *  completa (editar/excluir) direto no card — reaproveita o EditSheet real
 *  de Tarefas (mesmo registro, reflete em Agenda → Tarefas). */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext, useDraggable, useDroppable, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { setTaskStatus, deleteTask } from '@/actions/tasks'
import { EditSheet } from '@/components/features/tasks/TasksBoardTaskViews'
import type { Task, Member } from '@/components/features/tasks/TasksBoardShared'

type Group = { id: string; name: string; position: number }

const COLUMNS: { status: 'open' | 'doing' | 'done'; label: string }[] = [
  { status: 'open', label: 'A Fazer' },
  { status: 'doing', label: 'Em Andamento' },
  { status: 'done', label: 'Concluído' },
]

const PRIORITY_LABEL: Record<string, string> = { low: 'Baixa', normal: 'Média', high: 'Alta' }

function fmtDate(d: string | null): string {
  if (!d) return ''
  return new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })
}

function DraggableTaskCard({ task, groupName, onEdit, onDelete }: { task: Task; groupName: string | null; onEdit: () => void; onDelete: () => void }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({ id: task.id })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }
  const isOverdue = task.due_date && task.status !== 'done' && task.due_date.split('T')[0] < new Date().toISOString().split('T')[0]

  return (
    <div ref={setNodeRef} style={style} className="group relative touch-none rounded-lg border bg-card p-2.5 space-y-1.5">
      <div {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing space-y-1.5 pr-5">
        <div className="text-sm truncate">{task.title}</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {groupName && <Badge variant="outline" className="text-[10px] px-1.5 h-4">{groupName}</Badge>}
          <Badge variant="outline" className="text-[10px] px-1.5 h-4">{PRIORITY_LABEL[task.priority] || task.priority}</Badge>
          {task.due_date && (
            <span className={`text-[10px] ${isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>{fmtDate(task.due_date)}</span>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações da tarefa"
            className="absolute top-1.5 right-1.5 h-6 w-6 rounded-md flex items-center justify-center text-muted-foreground/50 opacity-0 group-hover:opacity-100 hover:!text-foreground hover:bg-muted transition-colors"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
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

function DroppableColumn({ status, children }: { status: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <div ref={setNodeRef} className={`rounded-lg border bg-muted/20 p-3 min-h-[160px] transition-colors ${isOver ? 'ring-2 ring-primary/40' : ''}`}>
      {children}
    </div>
  )
}

export default function ProjectTasksKanban({ orgSlug, tasks, groups, members = [] }: { orgSlug: string; tasks: Task[]; groups: Group[]; members?: Member[] }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})
  const [editing, setEditing] = useState<Task | null>(null)
  const groupName = new Map(groups.map(g => [g.id, g.name]))

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function move(taskId: string, status: string) {
    setOptimistic(prev => ({ ...prev, [taskId]: status }))
    startTrans(async () => {
      const res = await setTaskStatus(orgSlug, taskId, status as 'open' | 'doing' | 'done')
      if (!(res as any).ok) {
        toast.error('Erro ao mover tarefa')
        setOptimistic(prev => { const { [taskId]: _r, ...rest } = prev; return rest })
        return
      }
      router.refresh()
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const taskId = active.id as string
    const targetStatus = over.id as string
    const currentStatus = optimistic[taskId] ?? tasks.find(t => t.id === taskId)?.status
    if (targetStatus && targetStatus !== currentStatus) move(taskId, targetStatus)
  }

  function handleDeleteTask(id: string) {
    if (!confirm('Excluir esta tarefa? Não pode ser desfeito.')) return
    startTrans(async () => {
      const res = await deleteTask(orgSlug, id)
      if (!(res as any).ok) { toast.error('Erro ao excluir tarefa'); return }
      toast.success('Tarefa excluída')
      setEditing(null)
      router.refresh()
    })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {COLUMNS.map(col => {
          const items = tasks.filter(t => (optimistic[t.id] ?? t.status) === col.status)
          return (
            <DroppableColumn key={col.status} status={col.status}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{col.label}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(t => (
                  <DraggableTaskCard
                    key={t.id}
                    task={t}
                    groupName={t.project_group_id ? groupName.get(t.project_group_id) || null : null}
                    onEdit={() => setEditing(t)}
                    onDelete={() => handleDeleteTask(t.id)}
                  />
                ))}
                {items.length === 0 && <div className="text-xs text-muted-foreground text-center py-6">Nenhuma tarefa</div>}
              </div>
            </DroppableColumn>
          )
        })}
      </div>

      <EditSheet
        task={editing}
        orgSlug={orgSlug}
        members={members}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); router.refresh() }}
        onDelete={handleDeleteTask}
      />
    </DndContext>
  )
}
