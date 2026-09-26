'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import TaskCard from '@/components/features/TaskCard'
import { fmtCurrency, type Selected } from './ContatosViewShared'
import { ActivityRow } from './ContatosViewDetailHelpers'

const ACTIVITY_FILTERS = [
  { key: 'todas', label: 'Todas' },
  { key: 'mensagens', label: 'Mensagens' },
  { key: 'ligacoes', label: 'Ligações' },
  { key: 'emails', label: 'E-mails' },
  { key: 'notas', label: 'Notas' },
  { key: 'tarefas', label: 'Tarefas' },
  { key: 'automacoes', label: 'Automações' },
] as const
type ActivityFilter = typeof ACTIVITY_FILTERS[number]['key']

/** Categoriza `act.type` (livre, sem enum fechado no banco) num dos filtros
 *  da aba. Tudo que não bate com um bucket específico cai em "Automações"
 *  — é o catch-all de eventos de sistema (IA, créditos, NPS, mudança de
 *  estágio etc.), coerente com o que a issue pede pra essa aba. */
function activityCategory(type: string): Exclude<ActivityFilter, 'todas'> {
  if (type.startsWith('whatsapp') || type.startsWith('instagram') || type.startsWith('message')) return 'mensagens'
  if (type.startsWith('call') || type.startsWith('voice') || type.includes('ligacao')) return 'ligacoes'
  if (type.startsWith('email')) return 'emails'
  if (type === 'note') return 'notas'
  return 'automacoes'
}

/** Aba Atividades — centraliza timeline + tarefas, com filtros por tipo.
 *  WhatsApp e e-mails não têm ação de disparo aqui (vivem na Conversa
 *  vinculada e no disparo de e-mail que já existem noutros lugares). */
export function ActivitiesTab({
  orgSlug, selected, onNewTask,
}: {
  orgSlug:   string
  selected:  NonNullable<Selected>
  onNewTask: () => void
}) {
  const [filter, setFilter] = useState<ActivityFilter>('todas')

  const filteredActivities = useMemo(() => {
    if (filter === 'todas' || filter === 'tarefas') return selected.activities
    return selected.activities.filter((act: any) => activityCategory(act.type) === filter)
  }, [selected.activities, filter])

  const showTimeline = filter !== 'tarefas'
  const showTasks = filter === 'todas' || filter === 'tarefas'

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted w-fit overflow-x-auto max-w-full">
          {ACTIVITY_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-semibold transition-colors ${
                filter === f.key ? 'bg-card shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onNewTask}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova atividade
        </Button>
      </div>

      <div className={`grid grid-cols-1 ${showTimeline && showTasks ? 'md:grid-cols-2' : ''} gap-4 md:h-[calc(100vh-360px)] md:min-h-[380px]`}>
        {showTimeline && (
        <div className="rounded-lg bg-card p-4 flex flex-col min-h-0">
          <h3 className="text-sm font-bold mb-3 shrink-0">Linha do tempo</h3>
          {filteredActivities.length > 0 ? (
            <div className="space-y-4 overflow-y-auto pr-1 min-h-0">
              {filteredActivities.map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade nessa categoria.</p>
          )}
        </div>
        )}

        {showTasks && (
          <div className="rounded-lg bg-card p-4 flex flex-col min-h-0">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <h3 className="text-sm font-bold">Tarefas</h3>
              <Button type="button" size="sm" variant="outline" onClick={onNewTask}>
                <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
              </Button>
            </div>
            {selected.tasks.length > 0 ? (
              <div className="space-y-3 overflow-y-auto pr-1 min-h-0">
                {selected.tasks.map((task: any) => (
                  <TaskCard key={task.id} task={task} orgSlug={orgSlug} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma tarefa vinculada.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
