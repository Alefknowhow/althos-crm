'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { toast } from 'sonner'
import { ArrowLeft, Archive, ArchiveRestore, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import ProjectTasksPanel from './ProjectTasksPanel'
import { updateProject, archiveProject, deleteProject } from '@/actions/projects'
import {
  PROJECT_STATUSES, PROJECT_STATUS_LABEL, PROJECT_HEALTHS, PROJECT_HEALTH_LABEL,
} from '@/lib/validators/project'
import { PROJECT_HEALTH_BADGE_CLASS } from '@/lib/trafego/project-status'
import type { ProjectRow } from '@/actions/projects'

type Group = { id: string; name: string; position: number }
type Task = { id: string; title: string; status: string; priority: string; due_date: string | null; project_group_id: string | null }
type Member = { user_id: string; name: string; email: string }

function fmtDate(d: string | null): string {
  if (!d) return '—'
  return new Date(`${d}T00:00:00`).toLocaleDateString('pt-BR')
}

export default function ProjectDetailShell({
  orgSlug, project, groups, tasks, members,
}: {
  orgSlug: string
  project: ProjectRow
  groups: Group[]
  tasks: Task[]
  members: Member[]
}) {
  const router = useRouter()
  const [isPending, startTrans] = useTransition()

  const total = project.tasksTotal
  const done = project.tasksDone
  const pct = total > 0 ? Math.round((done / total) * 100) : 0
  const open = total - done

  function changeStatus(status: string) {
    startTrans(async () => {
      const res = await updateProject(orgSlug, project.id, { status: status as any })
      if (!res.ok) { toast.error(res.error || 'Erro ao atualizar status'); return }
      router.refresh()
    })
  }

  function changeHealth(health: string) {
    startTrans(async () => {
      const res = await updateProject(orgSlug, project.id, { health: health as any })
      if (!res.ok) { toast.error(res.error || 'Erro ao atualizar saúde'); return }
      router.refresh()
    })
  }

  function toggleArchive() {
    startTrans(async () => {
      const res = await archiveProject(orgSlug, project.id, !project.archived_at)
      if (!res.ok) { toast.error(res.error || 'Erro ao arquivar projeto'); return }
      toast.success(project.archived_at ? 'Projeto reaberto' : 'Projeto arquivado')
      router.push(`/app/${orgSlug}/agenda/projetos`)
    })
  }

  function handleDelete() {
    if (!confirm(`Excluir o projeto "${project.name}"? As tarefas não são apagadas — só perdem o vínculo com o projeto.`)) return
    startTrans(async () => {
      const res = await deleteProject(orgSlug, project.id)
      if (!res.ok) { toast.error(res.error || 'Erro ao excluir projeto'); return }
      toast.success('Projeto excluído')
      router.push(`/app/${orgSlug}/agenda/projetos`)
    })
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/app/${orgSlug}/agenda/projetos`} className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Projetos
          </Link>
          <h1 className="text-xl font-semibold truncate">{project.name}</h1>
          {project.client_id ? (
            <Link href={`/app/${orgSlug}/contatos/${project.client_id}`} className="text-sm text-primary hover:underline">
              {project.client?.name}
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">Uso interno — sem cliente vinculado</span>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={toggleArchive}>
              {project.archived_at ? <ArchiveRestore className="w-3.5 h-3.5 mr-2" /> : <Archive className="w-3.5 h-3.5 mr-2" />}
              {project.archived_at ? 'Reabrir projeto' : 'Arquivar projeto'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={handleDelete} className="text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir projeto
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={project.status} onValueChange={changeStatus} disabled={isPending}>
          <SelectTrigger className="w-[160px] h-8 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECT_STATUSES.map(s => <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={project.health} onValueChange={changeHealth} disabled={isPending}>
          <SelectTrigger className={`w-[170px] h-8 text-sm border ${PROJECT_HEALTH_BADGE_CLASS[project.health]}`}><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROJECT_HEALTHS.map(h => <SelectItem key={h} value={h}>{PROJECT_HEALTH_LABEL[h]}</SelectItem>)}
          </SelectContent>
        </Select>

        {project.archived_at && <Badge variant="outline">Arquivado</Badge>}

        <div className="flex items-center gap-2 ml-auto min-w-[160px]">
          <Progress value={pct} className="h-1.5 w-28" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">{pct}% · {done}/{total}</span>
        </div>
      </div>

      <Tabs defaultValue="visao-geral">
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="tarefas">Tarefas</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="space-y-4 mt-4">
          {(project.objective || project.description) && (
            <div className="rounded-lg border p-4 space-y-2">
              {project.objective && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Objetivo</div>
                  <div className="text-sm">{project.objective}</div>
                </div>
              )}
              {project.description && (
                <div>
                  <div className="text-xs font-medium text-muted-foreground">Descrição</div>
                  <div className="text-sm whitespace-pre-wrap">{project.description}</div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Início</div>
              <div className="text-sm font-medium">{fmtDate(project.start_date)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Prazo</div>
              <div className="text-sm font-medium">{fmtDate(project.due_date)}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Tarefas em aberto</div>
              <div className="text-sm font-medium">{open}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Atrasadas</div>
              <div className="text-sm font-medium">{project.tasksOverdue}</div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          <ProjectTasksPanel
            orgSlug={orgSlug}
            projectId={project.id}
            clientId={project.client_id}
            clientName={project.client?.name || ''}
            groups={groups}
            tasks={tasks as any}
            members={members}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
