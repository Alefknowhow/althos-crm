'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { Loader2, Users, Store, Layers, Zap, CheckCircle2 } from 'lucide-react'
import { purchaseCreditPack, requestAddonChange } from '@/actions/addons'
import { CREDIT_PACKS } from '@/lib/plans/config'
import { EXTRA_USER_CENTS, EXTRA_ORG_CENTS, NICHE_MODULE_CENTS, FINANCEIRO_ONLY_CENTS, NICHE_MODULE_OPTIONS } from '@/lib/billing/addons'
import { formatPrice } from '@/lib/billing/plans'

interface Props {
  orgSlug: string
}

function ExtraUsersCard({ orgSlug }: { orgSlug: string }) {
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    setLoading(true)
    const res = await requestAddonChange(orgSlug, { kind: 'extra_users', details: { qty } })
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    setSent(true)
    toast.success('Solicitação enviada — nosso time confirma o ajuste em breve.')
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Usuários extras</h3>
      </div>
      <p className="text-xs text-muted-foreground">{formatPrice(EXTRA_USER_CENTS)}/usuário/mês — disponível a partir do Pro.</p>
      {sent ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Solicitação enviada.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={50} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-20" />
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Solicitar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function ExtraOrgsCard({ orgSlug }: { orgSlug: string }) {
  const [qty, setQty] = useState(1)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    setLoading(true)
    const res = await requestAddonChange(orgSlug, { kind: 'extra_orgs', details: { qty } })
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    setSent(true)
    toast.success('Solicitação enviada — nosso time confirma o ajuste em breve.')
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Store className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Lojas/agências extras</h3>
      </div>
      <p className="text-xs text-muted-foreground">{formatPrice(EXTRA_ORG_CENTS)}/loja/mês — disponível a partir do Pro.</p>
      {sent ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Solicitação enviada.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Input type="number" min={1} max={50} value={qty} onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))} className="w-20" />
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Solicitar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function NicheModuleCard({ orgSlug }: { orgSlug: string }) {
  const [module, setModule] = useState(NICHE_MODULE_OPTIONS[0].id)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit() {
    setLoading(true)
    const res = await requestAddonChange(orgSlug, { kind: 'niche_module', details: { module } })
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    setSent(true)
    toast.success('Solicitação enviada — nosso time confirma o ajuste em breve.')
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Módulos de nicho</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        {formatPrice(NICHE_MODULE_CENTS)}/mês — Financeiro sozinho: {formatPrice(FINANCEIRO_ONLY_CENTS)}/mês.
      </p>
      {sent ? (
        <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="w-3.5 h-3.5" /> Solicitação enviada.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Select value={module} onValueChange={setModule}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NICHE_MODULE_OPTIONS.map(o => <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Solicitar'}
          </Button>
        </div>
      )}
    </div>
  )
}

function CreditPacksCard({ orgSlug }: { orgSlug: string }) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)

  async function buy(idx: number) {
    setLoadingIdx(idx)
    const res = await purchaseCreditPack(orgSlug, idx)
    setLoadingIdx(null)
    if (!res.ok) return toast.error(res.error)
    window.location.href = res.checkoutUrl
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Créditos de IA</h3>
      </div>
      <p className="text-xs text-muted-foreground">Pacotes avulsos além dos créditos mensais do seu plano.</p>
      <div className="flex flex-wrap gap-2">
        {CREDIT_PACKS.map((pack, i) => (
          <Button
            key={pack.credits}
            variant="outline"
            size="sm"
            onClick={() => buy(i)}
            disabled={loadingIdx !== null}
            className="gap-1.5"
          >
            {loadingIdx === i ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            {pack.credits.toLocaleString('pt-BR')} créditos — {formatPrice(pack.priceCents)}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default function AddonsSection({ orgSlug }: Props) {
  return (
    <div className="rounded-none border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-sm">Complementos</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Pague só pelo que crescer — além do seu plano.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ExtraUsersCard orgSlug={orgSlug} />
        <ExtraOrgsCard orgSlug={orgSlug} />
        <NicheModuleCard orgSlug={orgSlug} />
        <CreditPacksCard orgSlug={orgSlug} />
      </div>
    </div>
  )
}
