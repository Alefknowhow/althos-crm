'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAdAccount } from '@/actions/marketing'

const PROVIDERS = [
  { value: 'meta', label: 'Meta (Facebook/Instagram)' },
  { value: 'google', label: 'Google Ads' },
  { value: 'tiktok', label: 'TikTok Ads' },
  { value: 'other', label: 'Outro' },
] as const

export default function NewAdAccountDialog({
  orgSlug,
  onDone,
  trigger,
}: {
  orgSlug: string
  onDone: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ provider: 'meta', name: '', external_id: '', notes: '' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await createAdAccount(orgSlug, form)
    setSaving(false)
    if (res.ok) {
      toast.success('Conta de anúncio criada')
      setOpen(false)
      setForm({ provider: 'meta', name: '', external_id: '', notes: '' })
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova conta de anúncio</DialogTitle>
          <DialogDescription>
            Uma "conta" é o agrupador das suas campanhas em uma plataforma (Meta Business, Google Ads, etc).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Plataforma *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.provider}
              onChange={e => setForm({ ...form, provider: e.target.value })}
            >
              {PROVIDERS.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Nome da conta *</Label>
            <Input
              required
              placeholder="Ex: Clínica Harmonia · Meta Business"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>ID externo (opcional)</Label>
            <Input
              placeholder="ID da conta no painel (ex: act_12345)"
              value={form.external_id}
              onChange={e => setForm({ ...form, external_id: e.target.value })}
            />
            <p className="text-xs text-muted-foreground">
              Útil para futuras integrações via API. Pode deixar em branco.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Notas (opcional)</Label>
            <Input
              placeholder="Ex: conta principal de tráfego"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || form.name.length < 2}>
              {saving ? 'Salvando...' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
