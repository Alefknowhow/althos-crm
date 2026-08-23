'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Megaphone, Loader2, Plus } from 'lucide-react'
import { createAdAccount } from '@/actions/marketing'
import { formatCurrency } from '@/lib/utils'

type AdAccount = { id: string; provider: string; name: string; external_id: string | null; status: string }
type CampaignRow = {
  id: string
  name: string
  objective: string | null
  status: string
  ad_accounts: { name: string; provider: string } | null
  metrics: { impressions: number; clicks: number; spend_cents: number; leads?: number }
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-green-100 text-green-800 border-green-200' },
  paused: { label: 'Pausada', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  archived: { label: 'Arquivada', className: 'bg-muted text-muted-foreground' },
}

export default function TrafficClientCampaignsCard({
  orgSlug, contatoId, accounts, campaigns,
}: { orgSlug: string; contatoId: string; accounts: AdAccount[]; campaigns: CampaignRow[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [provider, setProvider] = useState<'meta' | 'google' | 'tiktok' | 'other'>('meta')
  const [saving, setSaving] = useState(false)

  const totalSpend = campaigns.reduce((a, c) => a + c.metrics.spend_cents, 0)

  async function handleCreateAccount() {
    if (!name.trim()) { toast.error('Informe o nome da conta'); return }
    setSaving(true)
    const res = await createAdAccount(orgSlug, { provider, name, contato_id: contatoId })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Conta de anúncio criada')
    setName('')
    setShowForm(false)
    router.refresh()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" /> Campanhas do cliente</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Conta de anúncio
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {showForm && (
          <div className="flex items-end gap-2 p-3 border rounded-md bg-secondary/30">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nome da conta</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Conta Meta Ads do cliente" />
            </div>
            <div className="w-32 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Plataforma</label>
              <Select value={provider} onValueChange={v => setProvider(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="meta">Meta</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="tiktok">TikTok</SelectItem>
                  <SelectItem value="other">Outra</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={handleCreateAccount} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Salvar
            </Button>
          </div>
        )}

        {accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma conta de anúncio vinculada a este cliente ainda.</p>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              {accounts.length} conta{accounts.length !== 1 ? 's' : ''} · gasto (30d): <span className="font-medium text-foreground">{formatCurrency(totalSpend)}</span>
            </div>
            {campaigns.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma campanha registrada ainda.</p>
            ) : (
              <div className="space-y-2">
                {campaigns.map(c => {
                  const status = STATUS_LABEL[c.status] || STATUS_LABEL.active
                  return (
                    <div key={c.id} className="flex items-center justify-between text-sm border rounded-md p-2.5">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.ad_accounts?.name || '—'} · {c.metrics.impressions.toLocaleString('pt-BR')} impr. · {c.metrics.clicks.toLocaleString('pt-BR')} cliques
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="tabular-nums font-medium">{formatCurrency(c.metrics.spend_cents)}</span>
                        <Badge variant="outline" className={status.className}>{status.label}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
