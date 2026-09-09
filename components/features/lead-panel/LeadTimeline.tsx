import type { ActivityItem, Stage } from './LeadDataTab'

const labels: Record<string, string> = {
  manual_created: 'Criado manualmente', stage_changed: 'Movido de etapa',
  note: 'Nota', negotiation_action: 'Ação de negociação',
  whatsapp_sent: 'Mensagem enviada pelo WhatsApp', whatsapp_received: 'Mensagem recebida pelo WhatsApp',
  task_created: 'Tarefa criada', task_completed: 'Tarefa concluída',
}

type TimelineActivity = Omit<ActivityItem, 'payload'> & {
  payload: { text?: string; next_return_date?: string | null; from?: string; to?: string } | null
}

export default function LeadTimeline({ activities, stages = [] }: { activities: TimelineActivity[]; stages?: Stage[] }) {
  if (!activities.length) return <p className="text-sm text-muted-foreground text-center py-4">Nenhuma atividade ainda.</p>
  return (
    <ol className="space-y-4 border-l border-border ml-1 pl-4">
      {activities.map(act => (
        <li key={act.id} className="relative text-sm">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
          <div className="font-medium">
            {labels[act.type] || act.type}
            {act.created_by_name && <span className="text-xs font-normal text-muted-foreground"> por {act.created_by_name}</span>}
          </div>
          {act.type === 'stage_changed' && (
            <p className="text-xs text-muted-foreground mt-1">
              {stages.find(s => s.id === act.payload?.from)?.name || 'Etapa anterior'}
              {' → '}{stages.find(s => s.id === act.payload?.to)?.name || 'Nova etapa'}
            </p>
          )}
          {act.payload?.text && <div className="text-muted-foreground mt-1 whitespace-pre-wrap break-words bg-muted p-2 rounded">{act.payload.text}</div>}
          {act.payload?.next_return_date && (
            <p className="text-xs text-muted-foreground mt-1">
              Retorno registrado anteriormente: {new Date(act.payload.next_return_date + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          )}
          <time className="block text-xs text-muted-foreground mt-1" dateTime={act.created_at}>{new Date(act.created_at).toLocaleString('pt-BR')}</time>
        </li>
      ))}
    </ol>
  )
}
