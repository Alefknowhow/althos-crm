'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { updateLead, deleteLead } from '@/actions/contatos'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Trash2 } from 'lucide-react'

/**
 * Edição inline dos campos do lead direto na página completa — substitui o
 * antigo botão "Editar" que abria um painel lateral confuso. Sem popup: os
 * campos ficam abertos no bloco "Detalhes" e salvam no blur/submit.
 */
export default function ContatoQuickEditCard({
  lead, orgSlug, stages,
}: {
  lead: any
  orgSlug: string
  stages: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    const res = await updateLead(orgSlug, lead.id, formData)
    setSaving(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao salvar'); return }
    toast.success('Contato atualizado.')
    router.refresh()
  }

  async function handleDelete() {
    const res = await deleteLead(orgSlug, lead.id)
    if (!res.ok) { toast.error(res.error || 'Erro ao excluir'); return }
    router.push(`/app/${orgSlug}/contatos`)
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Detalhes</CardTitle>
        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => setDeleteOpen(true)} aria-label="Excluir">
          <Trash2 className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome</Label>
              <Input name="name" defaultValue={lead.name} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">E-mail</Label>
              <Input name="email" type="email" defaultValue={lead.email || ''} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone</Label>
              <Input name="phone" defaultValue={lead.phone || ''} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Estágio</Label>
              <select
                name="stage_id"
                defaultValue={lead.stage_id || ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
              >
                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (separadas por vírgula)</Label>
            <Input name="tags" defaultValue={lead.tags?.join(', ') || ''} />
          </div>
          <Button type="submit" size="sm" disabled={saving}>{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
        </form>
      </CardContent>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. O contato e todas suas atividades serão perdidos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
