'use client'

import { useState } from 'react'
import { Plus, ChevronDown, CheckSquare, Calendar } from 'lucide-react'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import TaskDialog from '@/components/features/TaskDialog'
import EventDialog from './EventDialog'

type Member = { user_id: string; name: string; email: string }

/** "+ Novo" da Agenda (issue #14 §5) — escolhe entre Nova tarefa e Novo
 *  evento, cada um com seu próprio formulário/dialog. Usado no cabeçalho da
 *  visão Calendário (a visão Tarefas já tem seu próprio botão dedicado). */
export default function AgendaCreateMenu({
  orgSlug, members = [], niche, defaultDate, onEventSaved, canCreateTasks = true,
}: {
  orgSlug: string
  members?: Member[]
  niche?: string | null
  defaultDate?: string
  /** Chamado depois de criar um evento por aqui — deixa a visão Calendário
   *  refazer o fetch da janela atual sem depender de router.refresh()
   *  (que não força o efeito de busca a rerodar, já que orgSlug/view/anchor
   *  não mudam). */
  onEventSaved?: () => void
  /** Esconde "Nova tarefa" pra quem não tem a permissão `tasks` — o servidor
   *  já recusa a criação (createTask), isso só evita mostrar uma opção que
   *  falharia (achado da revisão do PR #55). */
  canCreateTasks?: boolean
}) {
  const [openTask, setOpenTask] = useState(false)
  const [openEvent, setOpenEvent] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button title="Novo" aria-label="Novo">
            <Plus className="w-4 h-4 sm:mr-1" /> <span className="hidden sm:inline">Novo</span> <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setOpenEvent(true)}>
            <Calendar className="w-4 h-4 mr-2" /> Novo evento
          </DropdownMenuItem>
          {canCreateTasks && (
            <DropdownMenuItem onSelect={() => setOpenTask(true)}>
              <CheckSquare className="w-4 h-4 mr-2" /> Nova tarefa
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <EventDialog
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        defaultDate={defaultDate}
        open={openEvent}
        onOpenChange={setOpenEvent}
        onSaved={onEventSaved}
      />
      <TaskDialog
        orgSlug={orgSlug}
        members={members}
        niche={niche}
        defaultDate={defaultDate}
        open={openTask}
        onOpenChange={setOpenTask}
        trigger={<span className="hidden" />}
      />
    </>
  )
}
