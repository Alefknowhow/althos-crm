'use client'

/**
 * Task detail sub-components for TasksBoard: the popover shown from a
 * calendar chip, the list-row used in the grouped list view, and the
 * edit sheet dialog. All prop-driven. Split out of TasksBoard.tsx.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import RelatedEntityCombobox, { type RelatedOption } from '@/components/features/tasks/RelatedEntityCombobox'
import { relatedTypeOptions, RELATED_TYPE_LABELS, type RelatedTypeValue } from '@/lib/tasks/related-types'
import UserAvatar from '@/components/features/UserAvatar'
import { updateTask } from '@/actions/tasks'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { CheckCircle2, Circle, Trash2, MoreVertical, Pencil } from 'lucide-react'
import { PRIORITY_META, fmtDate, dueTimeOnly, combineDueDate, isOverdue, memberLabelColor, FOCUS_RING, type Task, type Member } from './TasksBoardShared'

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

// ── Drawer de edição completa ────────────────────────────────────────────────

export function EditSheet({
  task, orgSlug, members, niche, onClose, onSaved, onDelete,
}: {
  task: Task | null
  orgSlug: string
  members: Member[]
  niche?: string | null
  onClose: () => void
  onSaved: (t: Task) => void
  onDelete: (id: string) => void
}) {
  const [saving, setSaving] = useState(false)
  const [relatedType, setRelatedType] = useState<RelatedTypeValue>('contato')
  const [relatedOption, setRelatedOption] = useState<RelatedOption | null>(null)
  const typeOptions = relatedTypeOptions(niche)

  // Reinicializa o bloco "Relacionado a" sempre que abre uma tarefa diferente.
  useEffect(() => {
    if (!task) return
    if (task.leads) { setRelatedType('contato'); setRelatedOption({ id: task.leads.id, label: task.leads.name }) }
    else if (task.sale_id && task.related) { setRelatedType('reserva'); setRelatedOption({ id: task.sale_id, label: task.related.label }) }
    else if (task.related_entity_type && task.related_entity_id && task.related) { setRelatedType(task.related_entity_type as RelatedTypeValue); setRelatedOption({ id: task.related_entity_id, label: task.related.label }) }
    else { setRelatedType('contato'); setRelatedOption(null) }
  }, [task])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!task) return
    const fd = new FormData(e.currentTarget)
    const dueDateRaw = fd.get('due_date') as string
    const dueTimeRaw = fd.get('due_time') as string
    const relationPayload =
      relatedType === 'contato' ? { contato_id: relatedOption?.id || '' }
      : relatedType === 'reserva' ? { sale_id: relatedOption?.id || '' }
      : { related_entity_type: (relatedOption ? relatedType : '') as any, related_entity_id: relatedOption?.id || '' }
    const input = {
      title:       fd.get('title')       as string,
      description: fd.get('description') as string,
      due_date:    combineDueDate(dueDateRaw, dueTimeRaw) || '',
      priority:    fd.get('priority')    as 'low' | 'normal' | 'high',
      assigned_to: ((fd.get('assigned_to') as string) === '__unassigned__' ? '' : fd.get('assigned_to') as string),
      ...relationPayload,
    }
    setSaving(true)
    const res = await updateTask(orgSlug, task.id, input)
    setSaving(false)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao salvar')
      return
    }
    toast.success('Tarefa atualizada!')
    const assignee_name = input.assigned_to
      ? (members.find(m => m.user_id === input.assigned_to)?.name ?? null)
      : null
    const related = relatedOption ? { type: relatedType, label: relatedOption.label } : null
    onSaved({ ...task, ...input, due_date: input.due_date || null, assignee_name, related })
  }

  const defaultDate = task?.due_date ? task.due_date.split('T')[0] : ''
  const defaultTime = dueTimeOnly(task?.due_date) || ''

  return (
    <Dialog open={!!task} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editar Tarefa</DialogTitle></DialogHeader>
        {task && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input name="title" required defaultValue={task.title} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <textarea name="description" className="flex min-h-[80px] w-full rounded-md border border-input bg-input/25 px-3 py-2 text-sm" defaultValue={task.description || ''} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de Vencimento</Label>
                <Input type="date" name="due_date" defaultValue={defaultDate} />
              </div>
              <div className="space-y-2">
                <Label>Horário <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input type="time" name="due_time" defaultValue={defaultTime} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select name="priority" defaultValue={task.priority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Relacionado a <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="grid grid-cols-2 gap-2">
                <Select
                  value={relatedType}
                  onValueChange={v => { setRelatedType(v as RelatedTypeValue); setRelatedOption(null) }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {typeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <RelatedEntityCombobox
                  orgSlug={orgSlug}
                  entityType={relatedType}
                  defaultValue={relatedOption}
                  onChange={setRelatedOption}
                />
              </div>
            </div>
            {members.length > 0 && (
              <div className="space-y-2">
                <Label>Responsável</Label>
                <Select name="assigned_to" defaultValue={task.assigned_to || '__unassigned__'}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__unassigned__">Sem responsável</SelectItem>
                    {members.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="destructive" onClick={() => onDelete(task.id)}>
                <Trash2 className="w-4 h-4 mr-1" /> Excluir
              </Button>
              <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
