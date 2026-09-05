'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowRightLeft, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { bulkUpdateLeads, bulkDeleteLeads } from '@/actions/contatos'
import type { Stage } from './LeadsViewShared'

/* -------- Bulk action bar -------- */

export default function BulkBar({
  orgSlug,
  selected,
  stages,
  onClear,
  onDone,
}: {
  orgSlug: string
  selected: Set<string>
  stages: Stage[]
  onClear: () => void
  onDone: () => void
}) {
  const ids = useMemo(() => Array.from(selected), [selected])
  const [loading, setLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function moveToStage(stageId: string) {
    setLoading(true)
    const res = await bulkUpdateLeads(orgSlug, ids, { stage_id: stageId })
    setLoading(false)
    if (res.ok) {
      toast.success(`${res.count} lead(s) movido(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  async function addTag() {
    const tag = window.prompt('Tag a adicionar:')?.trim()
    if (!tag) return
    setLoading(true)
    const res = await bulkUpdateLeads(orgSlug, ids, { addTag: tag })
    setLoading(false)
    if (res.ok) {
      toast.success(`Tag "${tag}" adicionada a ${res.count} lead(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  async function deleteSelected() {
    setLoading(true)
    const res = await bulkDeleteLeads(orgSlug, ids)
    setLoading(false)
    if (res.ok) {
      toast.success(`${res.count} lead(s) excluído(s)`)
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  function exportCsv() {
    // Simple client-side export of selected ids — server action with full data
    // is the next iteration; for now we hand the IDs to the user as CSV.
    const blob = new Blob([['contato_id', ...ids].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-selected-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-card border   rounded-full px-4 py-2 flex items-center gap-2">
      <span className="text-sm font-medium pr-2">{ids.length} selecionado(s)</span>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" disabled={loading}>
            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" /> Mover estágio
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {stages.map(s => (
            <DropdownMenuItem key={s.id} onClick={() => moveToStage(s.id)}>
              {s.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button size="sm" variant="outline" disabled={loading} onClick={addTag}>
        <TagIcon className="w-3.5 h-3.5 mr-1.5" /> Tag
      </Button>

      <Button size="sm" variant="outline" disabled={loading} onClick={exportCsv}>
        Exportar
      </Button>

      <Button size="sm" variant="destructive" disabled={loading} onClick={() => setShowDeleteConfirm(true)}>
        <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir
      </Button>

      <Button size="sm" variant="ghost" onClick={onClear}>
        <X className="w-4 h-4" />
      </Button>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir leads?</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir {ids.length} lead(s)? Essa ação é irreversível.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { deleteSelected(); setShowDeleteConfirm(false) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
