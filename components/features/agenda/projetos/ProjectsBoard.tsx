'use client'

/** Kanban geral de Agenda → Projetos (issue #17) — etapas configuráveis
 *  (project_columns) em vez das 3 fixas da versão anterior. dnd-kit em vez
 *  de HTML5 DnD nativo (mesma lib de KanbanBoard.tsx/Pipeline), mas sem
 *  SortableContext/reordenação dentro da coluna — só a mudança de coluna
 *  importa aqui, não a posição relativa dentro dela. */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext, useDraggable, useDroppable, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ProjectCard from './ProjectCard'
import { setProjectColumn } from '@/actions/projects'
import type { ProjectRow } from '@/actions/projects'
import type { ProjectColumn } from '@/actions/project-columns'

function DraggableProjectCard({ orgSlug, project, columnId }: { orgSlug: string; project: ProjectRow; columnId: string }) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: project.id,
    data: { columnId },
  })
  const style = { transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.35 : 1 }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="relative group touch-none">
      <ProjectCard orgSlug={orgSlug} project={project} />
    </div>
  )
}

function DroppableColumn({ column, children }: { column: ProjectColumn; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id })
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border bg-muted/20 p-3 min-h-[200px] transition-colors ${isOver ? 'ring-2 ring-primary/40' : ''}`}
    >
      {children}
    </div>
  )
}

export default function ProjectsBoard({ orgSlug, projects, columns }: { orgSlug: string; projects: ProjectRow[]; columns: ProjectColumn[] }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  function moveTo(id: string, columnId: string) {
    setOptimistic(prev => ({ ...prev, [id]: columnId }))
    startTrans(async () => {
      const res = await setProjectColumn(orgSlug, id, columnId)
      if (!res.ok) {
        toast.error(res.error || 'Erro ao mover projeto')
        setOptimistic(prev => { const { [id]: _removed, ...rest } = prev; return rest })
        return
      }
      router.refresh()
    })
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const projectId = active.id as string
    const targetColumnId = over.id as string
    const currentColumnId = optimistic[projectId] ?? projects.find(p => p.id === projectId)?.column_id
    if (targetColumnId && targetColumnId !== currentColumnId) moveTo(projectId, targetColumnId)
  }

  if (columns.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-12">Nenhuma etapa configurada ainda.</div>
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 overflow-x-auto">
        {columns.map(column => {
          const items = projects.filter(p => (optimistic[p.id] ?? p.column_id) === column.id)
          return (
            <DroppableColumn key={column.id} column={column}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">{column.name}</h3>
                <span className="text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(p => (
                  <div key={p.id} className="relative group">
                    <DraggableProjectCard orgSlug={orgSlug} project={p} columnId={column.id} />
                    {/* Alternativa acessível ao drag & drop. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost" size="icon"
                          className="absolute top-1.5 right-1.5 h-6 w-6 opacity-0 group-hover:opacity-100 bg-card/80"
                          onClick={e => e.preventDefault()}
                        >
                          <MoreHorizontal className="w-3.5 h-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.preventDefault()}>
                        {columns.filter(c => c.id !== column.id).map(c => (
                          <DropdownMenuItem key={c.id} onSelect={() => moveTo(p.id, c.id)}>
                            Mover para {c.name}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-muted-foreground text-center py-6">Nenhum projeto</div>
                )}
              </div>
            </DroppableColumn>
          )
        })}
      </div>
    </DndContext>
  )
}
