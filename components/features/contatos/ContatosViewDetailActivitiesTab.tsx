'use client'

import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import TaskCard from '@/components/features/TaskCard'
import { fmtCurrency, type Selected } from './ContatosViewShared'
import { ActivityRow } from './ContatosViewDetailHelpers'

/** Aba Atividades — meia tela de linha do tempo, meia tela de tarefas,
 *  cada lado com scroll independente. WhatsApp e e-mails saíram daqui
 *  (viviam num card à parte, redundante com a Conversa vinculada e o
 *  disparo de e-mail que já existem noutros lugares da tela). */
export function ActivitiesTab({
  orgSlug, selected, onNewTask,
}: {
  orgSlug:   string
  selected:  NonNullable<Selected>
  onNewTask: () => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:h-[calc(100vh-320px)] md:min-h-[420px]">
      <div className="rounded-lg bg-card p-4 flex flex-col min-h-0">
        <h3 className="text-sm font-bold mb-3 shrink-0">Linha do tempo</h3>
        {selected.activities.length > 0 ? (
          <div className="space-y-4 overflow-y-auto pr-1 min-h-0">
            {selected.activities.map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhuma atividade registrada.</p>
        )}
      </div>

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
    </div>
  )
}
