'use client'

/**
 * Full task edit dialog for TasksBoard. Prop-driven, split out of
 * TasksBoardTaskViews.tsx.
 */

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import RelatedEntityCombobox, { type RelatedOption } from '@/components/features/tasks/RelatedEntityCombobox'
import { relatedTypeOptions, type RelatedTypeValue } from '@/lib/tasks/related-types'
import { updateTask } from '@/actions/tasks'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { dueTimeOnly, combineDueDate, type Task, type Member } from './TasksBoardShared'

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
