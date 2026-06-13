'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toggleTaskStatus, updateTask, deleteTask } from '@/actions/tasks'
import Link from 'next/link'
import LeadCombobox from '@/components/features/LeadCombobox'
import { toast } from 'sonner'

export default function TaskCard({ task, orgSlug }: { task: any, orgSlug: string }) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [optimisticStatus, setOptimisticStatus] = useState(task.status)

  async function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const newStatus = e.target.checked ? 'done' : 'open'
    setOptimisticStatus(newStatus)
    const res = await toggleTaskStatus(orgSlug, task.id, newStatus)
    if (!res.ok) {
      setOptimisticStatus(task.status) // reverte otimista
      toast.error('Erro ao atualizar tarefa')
    }
    router.refresh()
  }

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input = {
      title:       fd.get('title')       as string,
      description: fd.get('description') as string,
      due_date:    fd.get('due_date')    as string,
      priority:    fd.get('priority')    as 'low' | 'normal' | 'high',
      contato_id:     fd.get('contato_id')     as string,
    }
    const res = await updateTask(orgSlug, task.id, input)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao salvar')
      return
    }
    toast.success('Tarefa atualizada!')
    setSheetOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    const res = await deleteTask(orgSlug, task.id)
    if (!res.ok) {
      toast.error('Erro ao excluir tarefa')
      return
    }
    toast.success('Tarefa excluída')
    router.refresh()
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  // if due_date is literally today's date but at 00:00:00 UTC, we must be careful with comparisons.
  // just comparing ISO date portion
  const isOverdue = task.due_date && task.due_date.split('T')[0] < today.toISOString().split('T')[0] && optimisticStatus !== 'done'

  const priorityColors: any = { low: 'bg-green-100 text-green-800 border-green-200', normal: 'bg-yellow-100 text-yellow-800 border-yellow-200', high: 'bg-red-100 text-red-800 border-red-200' }
  const defaultDate = task.due_date ? task.due_date.split('T')[0] : ''

  return (
    <>
      <div className="flex items-start md:items-center gap-4 p-4 border rounded-xl bg-card hover:border-primary/50 transition-colors">
        <input 
          type="checkbox" 
          className="w-5 h-5 mt-1 md:mt-0 rounded border-gray-300 accent-primary cursor-pointer"
          checked={optimisticStatus === 'done'}
          onChange={handleToggle}
        />
        <div className="flex-1 cursor-pointer" onClick={() => setSheetOpen(true)}>
          <div className={`font-medium ${optimisticStatus === 'done' ? 'line-through text-muted-foreground' : ''}`}>{task.title}</div>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
            {task.due_date && <span className={isOverdue ? 'text-destructive font-medium' : ''}>{new Date(task.due_date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>}
            <Badge className={`text-[10px] px-1 h-4 ${priorityColors[task.priority]}`} variant="outline">{task.priority === 'low' ? 'Baixa' : task.priority === 'normal' ? 'Média' : 'Alta'}</Badge>
            {isOverdue && <Badge variant="destructive" className="text-[10px] px-1 h-4">Atrasada</Badge>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {task.leads && (
            <Link href={`/app/${orgSlug}/contatos/${task.leads.id}`} className="text-sm text-primary hover:underline" onClick={e => e.stopPropagation()}>
              {task.leads.name}
            </Link>
          )}
          <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive hover:bg-destructive/10 hidden md:flex">Excluir</Button>
        </div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Editar Tarefa</SheetTitle></SheetHeader>
          <form onSubmit={handleEdit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input name="title" required defaultValue={task.title} />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <textarea name="description" className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" defaultValue={task.description || ''} />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento</Label>
              <Input type="date" name="due_date" defaultValue={defaultDate} />
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <select name="priority" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm" defaultValue={task.priority}>
                <option value="low">Baixa</option>
                <option value="normal">Média</option>
                <option value="high">Alta</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Lead</Label>
              <LeadCombobox
                name="contato_id"
                orgSlug={orgSlug}
                defaultLead={task.leads ? { id: task.leads.id, name: task.leads.name } : null}
              />
            </div>
            <SheetFooter>
              <Button type="button" variant="destructive" onClick={() => {
                setSheetOpen(false)
                handleDelete()
              }}>Excluir</Button>
              <Button type="submit">Salvar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  )
}
