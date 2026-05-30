'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateLead, deleteLead, addLeadNote } from '@/actions/leads'

export default function LeadDetailActions({ lead, orgSlug, stages }: { lead: any, orgSlug: string, stages: any[] }) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await updateLead(orgSlug, lead.id, formData)
    setLoading(false)
    if (!res.ok) {
      const { toast } = await import('sonner')
      toast.error(res.error || 'Erro ao salvar')
      return
    }
    setSheetOpen(false)
    router.refresh()
  }

  async function handleAddNote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    const formData = new FormData(e.currentTarget)
    const res = await addLeadNote(orgSlug, lead.id, formData)
    setLoading(false)
    if (!res.ok) {
      const { toast } = await import('sonner')
      toast.error(res.error || 'Erro ao adicionar nota')
      return
    }
    setNoteOpen(false)
    router.refresh()
  }

  async function handleDelete() {
    setLoading(true)
    const res = await deleteLead(orgSlug, lead.id)
    if (!res.ok) {
      setLoading(false)
      const { toast } = await import('sonner')
      toast.error(res.error || 'Erro ao excluir lead')
      return
    }
    router.push(`/app/${orgSlug}/leads`)
  }

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setNoteOpen(true)}>Adicionar Nota</Button>
      <Button variant="outline" onClick={() => setSheetOpen(true)}>Editar</Button>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>Excluir</Button>

      {/* Sheet Edit */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent>
          <SheetHeader><SheetTitle>Editar Lead</SheetTitle></SheetHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input name="name" defaultValue={lead.name} required />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input name="email" type="email" defaultValue={lead.email || ''} />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input name="phone" defaultValue={lead.phone || ''} />
            </div>
            <div className="space-y-2">
              <Label>Estágio</Label>
              <select name="stage_id" defaultValue={lead.stage_id} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Tags (separadas por vírgula)</Label>
              <Input name="tags" defaultValue={lead.tags?.join(', ') || ''} />
            </div>
            <SheetFooter>
              <Button type="submit" disabled={loading}>Salvar</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Dialog Add Note */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar Nota</DialogTitle></DialogHeader>
          <form onSubmit={handleAddNote} className="space-y-4">
            <div className="space-y-2">
              <Label>Nota</Label>
              <textarea name="text" required className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={loading}>Adicionar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirm Delete */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Tem certeza?</DialogTitle></DialogHeader>
          <div className="py-4">Essa ação não pode ser desfeita. O lead e todas suas atividades serão perdidos.</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={loading}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={loading}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
