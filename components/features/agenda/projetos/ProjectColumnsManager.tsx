'use client'

/** Gerenciar etapas do Kanban de Projetos (issue #17) — mesmo espírito de um
 *  editor de colunas de pipeline, mas simples: nome, ordem (posição de
 *  criação), marcar "conclui o projeto". Só owner/admin (checado no server). */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Settings2, Plus, Trash2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ActionButton } from '@/components/features/ActionButton'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog'
import {
  createProjectColumn, renameProjectColumn, deleteProjectColumn, toggleProjectColumnDone,
} from '@/actions/project-columns'
import type { ProjectColumn } from '@/actions/project-columns'
import { cn } from '@/lib/utils'

export default function ProjectColumnsManager({ orgSlug, columns }: { orgSlug: string; columns: ProjectColumn[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTrans] = useTransition()
  const [newName, setNewName] = useState('')

  function addColumn() {
    if (!newName.trim()) return
    startTrans(async () => {
      const res = await createProjectColumn(orgSlug, newName.trim())
      if (!res.ok) { toast.error(res.error || 'Erro ao criar etapa'); return }
      setNewName('')
      router.refresh()
    })
  }

  function rename(id: string, current: string) {
    const name = prompt('Renomear etapa', current)
    if (!name || name === current) return
    startTrans(async () => {
      const res = await renameProjectColumn(orgSlug, id, name)
      if (!res.ok) toast.error(res.error || 'Erro ao renomear etapa')
      router.refresh()
    })
  }

  function toggleDone(id: string, isDone: boolean) {
    startTrans(async () => {
      const res = await toggleProjectColumnDone(orgSlug, id, !isDone)
      if (!res.ok) toast.error(res.error || 'Erro ao atualizar etapa')
      router.refresh()
    })
  }

  function remove(id: string, name: string) {
    if (!confirm(`Excluir a etapa "${name}"? Projetos nela vão pra outra etapa.`)) return
    startTrans(async () => {
      const res = await deleteProjectColumn(orgSlug, id)
      if (!res.ok) { toast.error(res.error || 'Erro ao excluir etapa'); return }
      router.refresh()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 className="w-3.5 h-3.5 sm:mr-1" /> <span className="hidden sm:inline">Gerenciar etapas</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Etapas do Kanban de Projetos</DialogTitle></DialogHeader>
        <div className="space-y-2">
          {columns.map(col => (
            <div key={col.id} className="flex items-center gap-2 rounded-lg border p-2">
              <button
                type="button"
                title={col.is_done ? 'Etapa conclui o projeto' : 'Marcar como etapa de conclusão'}
                onClick={() => toggleDone(col.id, col.is_done)}
                disabled={isPending}
              >
                <CheckCircle2 className={cn('w-4 h-4', col.is_done ? 'text-success' : 'text-muted-foreground/40')} />
              </button>
              <button type="button" className="flex-1 text-left text-sm truncate" onClick={() => rename(col.id, col.name)}>
                {col.name}
              </button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(col.id, col.name)} disabled={isPending}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome da nova etapa"
            onKeyDown={e => { if (e.key === 'Enter') addColumn() }}
          />
          <ActionButton size="sm" onClick={addColumn} pending={isPending}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
          </ActionButton>
        </div>
      </DialogContent>
    </Dialog>
  )
}
