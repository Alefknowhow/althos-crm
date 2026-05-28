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
import { recordCampaignMetric } from '@/actions/marketing'

type Campaign = { id: string; name: string; color: string | null }

function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function RecordSpendDialog({
  orgSlug,
  campaigns,
  onDone,
  trigger,
}: {
  orgSlug: string
  campaigns: Campaign[]
  onDone: () => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    campaign_id: campaigns[0]?.id || '',
    date: todayLocal(),
    spend: '', // R$ as decimal string
    impressions: '',
    clicks: '',
  })

  // Same fix as NewCampaignDialog: useState initializer captures campaigns
  // at mount time, but campaigns can change (refresh after creating one).
  // Sync explicitly so the controlled select value matches an option.
  useEffect(() => {
    if (campaigns.length > 0 && !campaigns.find(c => c.id === form.campaign_id)) {
      setForm(f => ({ ...f, campaign_id: campaigns[0].id }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaigns])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.campaign_id) {
      toast.error('Selecione uma campanha')
      return
    }
    // Convert spend (R$ with comma or dot) to cents.
    const spendNum = parseFloat(form.spend.replace(',', '.')) || 0
    setSaving(true)
    const res = await recordCampaignMetric(orgSlug, {
      campaign_id: form.campaign_id,
      date: form.date,
      spend_cents: Math.round(spendNum * 100),
      impressions: form.impressions ? parseInt(form.impressions, 10) || 0 : 0,
      clicks: form.clicks ? parseInt(form.clicks, 10) || 0 : 0,
      source: 'manual',
    })
    setSaving(false)
    if (res.ok) {
      toast.success('Gasto lançado')
      setOpen(false)
      setForm({
        campaign_id: campaigns[0]?.id || '',
        date: todayLocal(),
        spend: '',
        impressions: '',
        clicks: '',
      })
      onDone()
    } else {
      toast.error(res.error)
    }
  }

  if (campaigns.length === 0) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crie uma campanha primeiro</DialogTitle>
            <DialogDescription>
              Você precisa cadastrar pelo menos uma campanha antes de lançar gastos.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar gasto diário</DialogTitle>
          <DialogDescription>
            Lança valores manualmente (entrada rápida). Se preferir, use o import CSV.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Campanha *</Label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
              value={form.campaign_id}
              onChange={e => setForm({ ...form, campaign_id: e.target.value })}
              required
            >
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={e => setForm({ ...form, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Gasto (R$) *</Label>
              <Input
                inputMode="decimal"
                placeholder="100,50"
                value={form.spend}
                onChange={e => setForm({ ...form, spend: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Impressões</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.impressions}
                onChange={e => setForm({ ...form, impressions: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Cliques</Label>
              <Input
                type="number"
                min={0}
                placeholder="0"
                value={form.clicks}
                onChange={e => setForm({ ...form, clicks: e.target.value })}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Lançar a mesma data 2x sobrescreve o valor anterior (idempotente).
          </p>

          <DialogFooter>
            <Button type="submit" disabled={saving || !form.spend}>
              {saving ? 'Salvando...' : 'Lançar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
