'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { MoreHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import ProjectCard from './ProjectCard'
import { setProjectStatus } from '@/actions/projects'
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL, type ProjectStatus } from '@/lib/validators/project'
import type { ProjectRow } from '@/actions/projects'

export default function ProjectsBoard({ orgSlug, projects }: { orgSlug: string; projects: ProjectRow[] }) {
  const router = useRouter()
  const [, startTrans] = useTransition()
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<ProjectStatus | null>(null)
  const [optimistic, setOptimistic] = useState<Record<string, ProjectStatus>>({})

  function moveTo(id: string, status: ProjectStatus) {
    setOptimistic(prev => ({ ...prev, [id]: status }))
    startTrans(async () => {
      const res = await setProjectStatus(orgSlug, id, status)
      if (!res.ok) {
        toast.error(res.error || 'Erro ao mover projeto')
        setOptimistic(prev => {
          const { [id]: _removed, ...rest } = prev
          return rest
        })
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 overflow-x-auto">
      {PROJECT_STATUSES.map(status => {
        const items = projects.filter(p => (optimistic[p.id] ?? p.status) === status)
        return (
          <div
            key={status}
            className={`rounded-lg border bg-muted/20 p-3 min-h-[200px] transition-colors ${overCol === status ? 'ring-2 ring-primary/40' : ''}`}
            onDragOver={e => { e.preventDefault(); setOverCol(status) }}
            onDragLeave={() => setOverCol(prev => (prev === status ? null : prev))}
            onDrop={e => {
              e.preventDefault()
              setOverCol(null)
              const id = dragId || e.dataTransfer.getData('text/plain')
              if (id) moveTo(id, status)
              setDragId(null)
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold">{PROJECT_STATUS_LABEL[status]}</h3>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map(p => (
                <div key={p.id} className="relative group">
                  <ProjectCard
                    orgSlug={orgSlug}
                    project={p}
                    draggable
                    onDragStart={e => { setDragId(p.id); e.dataTransfer.setData('text/plain', p.id) }}
                  />
                  {/* Alternativa acessível ao drag & drop, exigida pelo escopo. */}
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
                      {PROJECT_STATUSES.filter(s => s !== status).map(s => (
                        <DropdownMenuItem key={s} onSelect={() => moveTo(p.id, s)}>
                          Mover para {PROJECT_STATUS_LABEL[s]}
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
          </div>
        )
      })}
    </div>
  )
}
