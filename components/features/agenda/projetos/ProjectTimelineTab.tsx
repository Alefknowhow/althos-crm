'use client'

/** Timeline de Agenda → Projetos (issue #17 §5) — mesmo padrão visual de
 *  LeadTimeline.tsx (lista vertical, borda + bolinha). */

import type { ProjectActivity } from '@/actions/project-activities'

const LABELS: Record<string, string> = {
  created: 'Projeto criado',
  updated: 'Projeto atualizado',
  column_changed: 'Etapa alterada',
  archived: 'Projeto arquivado',
  unarchived: 'Projeto reaberto',
  group_created: 'Grupo criado',
  group_renamed: 'Grupo renomeado',
  group_deleted: 'Grupo excluído',
  task_created: 'Tarefa criada',
  task_completed: 'Tarefa concluída',
  template_applied: 'Template aplicado',
}

type Member = { user_id: string; name: string }

export default function ProjectTimelineTab({ activities, members = [] }: { activities: ProjectActivity[]; members?: Member[] }) {
  const memberName = new Map(members.map(m => [m.user_id, m.name]))

  if (!activities.length) {
    return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade ainda.</p>
  }

  return (
    <ol className="space-y-4 border-l border-border ml-1 pl-4">
      {activities.map(act => (
        <li key={act.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="font-medium">
            {LABELS[act.type] || act.type}
            {act.created_by && memberName.get(act.created_by) && (
              <span className="text-xs font-normal text-muted-foreground"> por {memberName.get(act.created_by)}</span>
            )}
          </div>
          {act.type === 'column_changed' && act.payload?.to != null && (
            <p className="text-xs text-muted-foreground mt-1">Nova etapa: {String(act.payload.to)}</p>
          )}
          {(act.type === 'created' || act.type === 'group_created' || act.type === 'group_renamed' || act.type === 'group_deleted' || act.type === 'template_applied') && act.payload?.name != null && (
            <p className="text-xs text-muted-foreground mt-1">{String(act.payload.name)}</p>
          )}
          {act.type === 'updated' && Array.isArray(act.payload?.fields) && (
            <p className="text-xs text-muted-foreground mt-1">Campos: {(act.payload.fields as string[]).join(', ')}</p>
          )}
          <time className="block text-xs text-muted-foreground mt-1" dateTime={act.created_at}>{new Date(act.created_at).toLocaleString('pt-BR')}</time>
        </li>
      ))}
    </ol>
  )
}
