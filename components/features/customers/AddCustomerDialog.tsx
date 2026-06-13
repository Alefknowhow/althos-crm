'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createCustomer } from '@/actions/contatos'
import { toast } from 'sonner'
import { UserPlus } from 'lucide-react'

export default function AddCustomerDialog({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await createCustomer(orgSlug, { name, email, phone })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Cliente adicionado')
    setOpen(false)
    setName(''); setEmail(''); setPhone('')
    router.push(`/app/${orgSlug}/contatos/${res.id}`)
  }

  return (
    <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) { setName(''); setEmail(''); setPhone('') } }}>
      <DialogTrigger asChild>
        <Button><UserPlus className="w-4 h-4 mr-1.5" /> Adicionar cliente</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar cliente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do cliente" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving || !name.trim()}>{saving ? 'Salvando…' : 'Adicionar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
