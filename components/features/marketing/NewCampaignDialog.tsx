'use client'

import { useState, useEffect } from 'react'
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
import { createCampaign } from '@/actions/marketing'

const OBJECTIVES = [
  { value: 'leads', label: 'Geração de Leads' },
  { value: 'traffic', label: 'Tráfego' },
  { value: 'conversions', label: 'Conversões' },
  { value: 'awareness', label: 'Reconhecimento' },
  { value: 'engagement', label: 'Engajamento' },
  { value: 'other', label: 'Outro' },
] as const

type Account = { id: string; provider: string; name: string; status: string }

export default function NewCampaignDialog({
  orgSlug,
  accounts,
  onDone,
  trigger,
}: {
  orgSlug: string
  accounts: Account[]
  onDone: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    ad_account_id: accounts[0]?.id || '',
    name: '',
    objective: 'leads',
    utm_campaign: '',
    color: '#3b82f6',
    started_at: '',
    ended_at: '',
  })

  // The component is often mounted before any account exists (the dropdown
  // is rendered alongside "Nova conta de anúncio"). When the user creates an
  // account and comes back, accounts changes but the initial useState already
  // captured ''. Sync explicitly so the dropdown's controlled value matches
  // one of the rendered options.
  useEffect(() => {
    if (accounts.length > 0 && !accounts.find(a => a.id === form.ad_account_id)) {
      setForm(f => ({ ...f, ad_account_id: accounts[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts])

  // Suggest a slug-friendly utm_campaign based on the name as the user types.
  function onNameChange(name: string) {
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    setForm(f => ({
      ...f,
      name,
      // Only auto-fill if the user hasn't typed a custom utm yet.
      utm_campaign: f.utm_campaign && f.utm_campaign !== '' ? f.utm_campaign : slug,
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ad_account_id) {
      toast.error('Crie uma conta de anúncio primeiro')
      return
    }
    setSaving(true)
    const res = await createCampaign(orgSlug, {
      ad_account_id: form.ad_account_id,
      name: form.name,
      objective: form.objective,
      utm_campaign: form.utm_campaign || null,
      color: form.color,
      started_at: form.started_at || null,
      ended_at: form.ended_at || null,
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Campanha criada')
      setOpen(false)
      setForm({
        ad_account_id: accounts[0]?.id || '',
        name: '',
        objective: 'leads',
        utm_campaign: '',
        color: '#3b82f6',
        started_at: '',
        ended_at: '',
      })
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  if (accounts.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crie uma conta primeiro</DialogTitle>
            <DialogDescription>
              Você precisa cadastrar pelo menos uma conta de anúncio (Meta, Google, etc) antes de
              criar campanhas.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova campanha</DialogTitle>
          <DialogDescription>
            Cadastre a campanha aqui para conectar os gastos (que você lança ou importa) aos leads
            que ela gera via UTM.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Conta de anúncio *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.ad_account_id}
              onChange={e => setForm({ ...form, ad_account_id: e.target.value })}
              required
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.provider})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Nome da campanha *</Label>
            <Input
              required
              placeholder="Ex: Captura Botox - Maio 2026"
              value={form.name}
              onChange={e => onNameChange(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Objetivo</Label>
              <select
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                value={form.objective}
                onChange={e => setForm({ ...form, objective: e.target.value })}
              >
                {OBJECTIVES.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                  className="h-9 w-12 rounded border cursor-pointer"
                />
                <Input
                  value={form.color}
                  onChange={e => setForm({ ...form, color: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>UTM Campaign</Label>
            <Input
              value={form.utm_campaign}
              onChange={e => setForm({ ...form, utm_campaign: e.target.value })}
              placeholder="ex: captura-botox-maio"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Use esse valor no parâmetro <code>utm_campaign</code> dos links que você anuncia.
              Quando o lead chegar pelo formulário, conectamos a campanha automaticamente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Início (opcional)</Label>
              <Input
                type="date"
                value={form.started_at}
                onChange={e => setForm({ ...form, started_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim (opcional)</Label>
              <Input
                type="date"
                value={form.ended_at}
                onChange={e => setForm({ ...form, ended_at: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={saving || form.name.length < 2}>
              {saving ? 'Criando...' : 'Criar campanha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
