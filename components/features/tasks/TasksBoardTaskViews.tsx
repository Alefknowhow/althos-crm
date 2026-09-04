'use client'

/**
 * Task detail sub-components for TasksBoard: the popover shown from a
 * calendar chip, the list-row used in the grouped list view, and the
 * edit sheet dialog. All prop-driven. Split out of TasksBoard.tsx.
 */

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import UserAvatar from '@/components/features/UserAvatar'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Trash2, MoreVertical, Pencil } from 'lucide-react'
import { PRIORITY_META, fmtDate, dueTimeOnly, isOverdue, memberLabelColor, FOCUS_RING, type Task, type Member } from './TasksBoardShared'

export { EditSheet } from './TasksBoardEditSheet'

export function TaskPopoverContent({
  task, orgSlug, members, onToggleDone, onSetPriority, onEdit, onDelete,
}: {
  task: Task
  orgSlug: string
  members: Member[]
  onToggleDone: () => void
  onSetPriority: (p: Task['priority']) => void
  onEdit: () => void
  onDelete: () => void
}) {
  const date = fmtDate(task.due_date)
  const time = dueTimeOnly(task.due_date)
  const done = task.status === 'done'
  const member = members.find(m => m.user_id === task.assigned_to)

  return (
    <div className="p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <p className={cn('text-sm font-semibold leading-snug', done && 'line-through text-muted-foreground')}>{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="shrink-0 text-muted-foreground hover:text-foreground">
              <MoreVertical className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit} className="cursor-pointer"><Pencil className="w-3.5 h-3.5 mr-2" /> Editar</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {date && <p className="text-xs text-muted-foreground">{date}{time && ` · ${time}`}</p>}
      {member && (
        <div className="flex items-center gap-1.5">
          <UserAvatar name={member.name} email={member.email} size={20} />
          <span className="text-xs text-muted-foreground">{member.name}</span>
        </div>
      )}

      <div className="flex items-center gap-1">
        {(['low', 'normal', 'high'] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onSetPriority(p)}
            className={cn(
              'text-[10px] px-2 h-5 rounded-pill border transition-colors',
              task.priority === p ? PRIORITY_META[p].cls : 'text-muted-foreground border-border hover:bg-muted',
            )}
          >
            {PRIORITY_META[p].label}
          </button>
        ))}
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-3">{task.description}</p>
      )}

      {task.leads && (
        <Link href={`/app/${orgSlug}/contatos/${task.leads.id}`} className="text-xs text-primary hover:underline block">
          {task.leads.name}
        </Link>
      )}

      <Button size="sm" variant={done ? 'outline' : 'default'} onClick={onToggleDone} className="w-full gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> {done ? 'Reabrir' : 'Concluir'}
      </Button>
    </div>
  )
}

// ── Linha da tarefa (lista) ──────────────────────────────────────────────────

export function TaskListRow({
  task, orgSlug, members, highlighted, onOpen, onToggleDone, onSetPriority, onDelete,
}: {
  task: Task
  orgSlug: string
  members: Member[]
  highlighted?: boolean
  onOpen: () => void
  onToggleDone: () => void
  onSetPriority: (p: Task['priority']) => void
  onDelete: () => void
}) {
  const pm = PRIORITY_META[task.priority]
  const overdue = isOverdue(task)
  const date = fmtDate(task.due_date)
  const time = dueTimeOnly(task.due_date)
  const done = task.status === 'done'
  const member = members.find(m => m.user_id === task.assigned_to)
  const relatedTypeLabel = task.related ? (RELATED_TYPE_LABELS[task.related.type as RelatedTypeValue] ?? 'Relacionado') : null
  const [previewOpen, setPreviewOpen] = useState(false)

  return (
    <div className={cn(
      'group relative flex items-center gap-3 pl-4 pr-3.5 py-2.5 min-h-[50px] hover:bg-muted/30 transition-colors duration-150',
      highlighted && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
    )}>
      <span
        className={cn('absolute left-0 top-1 bottom-1 w-1.5 rounded-r-sm', pm.dot)}
        title={`Prioridade: ${pm.label}`}
        aria-label={`Prioridade: ${pm.label}`}
      />

      <button
        type="button"
        onClick={onToggleDone}
        aria-label={done ? 'Reabrir' : 'Concluir'}
        className={cn('shrink-0 transition-transform active:scale-90', FOCUS_RING, 'rounded-full')}
      >
        {done
          ? <CheckCircle2 className="w-[18px] h-[18px] text-success" />
          : <Circle className="w-[18px] h-[18px] text-muted-foreground hover:text-foreground transition-colors" />}
      </button>

      <Popover open={previewOpen} onOpenChange={setPreviewOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            title={task.title}
            className="flex-1 min-w-0 text-left space-y-0.5"
          >
            {/* Linha 1: título (esq.) | responsável (largura fixa) + data/hora (dir.).
                Grid com coluna 2 de largura fixa (180px) — o responsável
                sempre começa no mesmo x, com espaço reservado pra data/hora
                não empurrar nada. Linha 2 usa o mesmo template, então o
                vínculo cai exatamente na mesma posição. */}
            <div className="grid grid-cols-[1fr_180px] gap-x-2 items-center">
              <span className={cn(
                'text-sm font-bold truncate min-w-0',
                done ? 'line-through text-muted-foreground' : 'text-foreground',
              )}>
                {task.title}
              </span>
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="w-20 shrink-0">
                  {member && (
                    <span className={cn('inline-block max-w-full truncate text-[10px] font-medium px-1.5 py-0.5 rounded-pill leading-none', memberLabelColor(member.user_id))}>
                      {member.name}
                    </span>
                  )}
                </span>
                <span className={cn(
                  'text-xs shrink-0',
                  date ? (overdue && !done ? 'text-destructive font-medium' : 'text-muted-foreground/80') : 'text-muted-foreground/40',
                )}>
                  {date ? `${date}${time ? ` · ${time}` : ''}` : 'Sem data'}
                </span>
              </span>
            </div>

            {/* Linha 2: descrição (esq.) | vínculo da tarefa (dir.). */}
            {(task.description || task.related) && (
              <div className="grid grid-cols-[1fr_180px] gap-x-2 items-center">
                <span className="text-xs text-muted-foreground truncate min-w-0">
                  {task.description || ''}
                </span>
                <span className="text-xs text-muted-foreground truncate whitespace-nowrap">
                  {task.related ? `${relatedTypeLabel}: ${task.related.label}` : ''}
                </span>
              </div>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-0" onClick={e => e.stopPropagation()}>
          <TaskPopoverContent
            task={task} orgSlug={orgSlug} members={members}
            onToggleDone={() => { onToggleDone(); setPreviewOpen(false) }}
            onSetPriority={p => onSetPriority(p)}
            onEdit={() => { setPreviewOpen(false); onOpen() }}
            onDelete={() => { onDelete(); setPreviewOpen(false) }}
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Ações"
            className={cn(
              'shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground/40 group-hover:text-muted-foreground hover:!text-foreground hover:bg-muted transition-colors',
              FOCUS_RING,
            )}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleDone} className="cursor-pointer">
            {done
              ? <><Circle className="w-3.5 h-3.5 mr-2" /> Reabrir</>
              : <><CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Concluir</>}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="cursor-pointer">
              <span className={cn('w-2 h-2 rounded-full mr-2', pm.dot)} />
              Prioridade
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {(['low', 'normal', 'high'] as const).map(p => (
                <DropdownMenuItem key={p} onClick={() => onSetPriority(p)} className="cursor-pointer">
                  {PRIORITY_META[p].label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="cursor-pointer text-destructive focus:text-destructive">
            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

