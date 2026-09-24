'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PROJECT_HEALTH_LABEL, PROJECT_STATUS_LABEL } from '@/lib/validators/project'
import { PROJECT_HEALTH_BADGE_CLASS } from '@/lib/trafego/project-status'
import type { ProjectRow } from '@/actions/projects'

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')
}

export default function ProjectsList({ orgSlug, projects }: { orgSlug: string; projects: ProjectRow[] }) {
  if (projects.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-12">Nenhum projeto encontrado.</div>
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Projeto</TableHead>
            <TableHead>Cliente</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Progresso</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Saúde</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map(p => {
            const pct = p.tasksTotal > 0 ? Math.round((p.tasksDone / p.tasksTotal) * 100) : 0
            return (
              <TableRow key={p.id} className="cursor-pointer">
                <TableCell>
                  <Link href={`/app/${orgSlug}/agenda/projetos/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.client?.name || 'Uso interno'}</TableCell>
                <TableCell className="text-muted-foreground">{p.owner?.name || '—'}</TableCell>
                <TableCell className="min-w-[140px]">
                  <div className="flex items-center gap-2">
                    <Progress value={pct} className="h-1.5 w-20" />
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{p.tasksDone}/{p.tasksTotal} · {pct}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{fmtDate(p.due_date)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-[10px] px-1.5 h-5 ${PROJECT_HEALTH_BADGE_CLASS[p.health]}`}>
                    {PROJECT_HEALTH_LABEL[p.health]}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{PROJECT_STATUS_LABEL[p.status]}</TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
