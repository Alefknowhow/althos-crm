'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { AlertTriangle } from 'lucide-react'
import { PROJECT_HEALTH_LABEL } from '@/lib/validators/project'
import { PROJECT_HEALTH_BADGE_CLASS } from '@/lib/trafego/project-status'
import type { ProjectRow } from '@/actions/projects'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

interface Props {
  orgSlug: string
  project: ProjectRow
  draggable?: boolean
  onDragStart?: (e: React.DragEvent) => void
}

export default function ProjectCard({ orgSlug, project, draggable, onDragStart }: Props) {
  const pct = project.tasksTotal > 0 ? Math.round((project.tasksDone / project.tasksTotal) * 100) : 0

  return (
    <Link
      href={`/app/${orgSlug}/agencias-trafego/projetos/${project.id}`}
      draggable={draggable}
      onDragStart={onDragStart}
      className="block rounded-lg border bg-card p-3 hover:border-primary/50 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium truncate">{project.name}</div>
          <div className="text-xs text-muted-foreground truncate">{project.client?.name}</div>
        </div>
        {project.owner?.name && (
          <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center" title={project.owner.name}>
            {project.owner.name.slice(0, 2).toUpperCase()}
          </div>
        )}
      </div>

      <div className="mt-3 space-y-1">
        <Progress value={pct} className="h-1.5" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{pct}%</span>
          <span>{project.tasksDone} / {project.tasksTotal} tarefas</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${PROJECT_HEALTH_BADGE_CLASS[project.health]}`}>
          {PROJECT_HEALTH_LABEL[project.health]}
        </Badge>
        {project.tasksOverdue > 0 && (
          <Badge variant="destructive" className="text-[10px] px-1.5 h-5 gap-1">
            <AlertTriangle className="w-3 h-3" /> {project.tasksOverdue} atrasada{project.tasksOverdue > 1 ? 's' : ''}
          </Badge>
        )}
        {project.due_date && <span className="text-[10px] text-muted-foreground ml-auto">até {fmtDate(project.due_date)}</span>}
      </div>
    </Link>
  )
}
