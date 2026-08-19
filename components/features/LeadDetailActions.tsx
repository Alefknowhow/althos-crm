'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateLead, deleteLead } from '@/actions/contatos'

export default function LeadDetailActions({ lead, orgSlug, stages }: { lead: any, orgSlug: string, stages: any[] }) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
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

  async function handleDelete() {
    setLoading(true)
    const res = await deleteLead(orgSlug, lead.id)
    if (!res.ok) {
      setLoading(false)
      const { toast } = await import('sonner')
      toast.error(res.error || 'Erro ao excluir lead')
      return
    }
    router.push(`/app/${orgSlug}/contatos`)
  }

  return (
    <div className="flex gap-2">
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
              <Select name="stage_id" defaultValue={lead.stage_id}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
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
