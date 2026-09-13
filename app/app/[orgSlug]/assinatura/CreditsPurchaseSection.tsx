'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Loader2, Sparkles, Phone, Mail, AlertTriangle } from 'lucide-react'
import { purchaseCreditPack, purchaseCustomCreditPack } from '@/actions/addons'
import { purchaseVoiceCredits, purchaseVoiceCreditsCustom } from '@/actions/voice'
import { purchaseEmailCredits, purchaseEmailCreditsCustom } from '@/actions/email-credits'
import { ADDON_CREDIT_PRICE_CENTS } from '@/lib/plans/config'
import { VOICE_CREDIT_PACKS } from '@/lib/voice/credit-packs'
import { EMAIL_CREDIT_PACKS } from '@/lib/email/credit-packs'
import { formatPrice } from '@/lib/billing/plans'
import { MIN_CUSTOM_AI_CREDITS, MIN_CUSTOM_VOICE_REAIS, MIN_CUSTOM_EMAIL_REAIS } from '@/lib/billing/credit-minimums'
import type { CreditsOverview } from '@/actions/billing-credits-overview'
import type { CreditPackage } from '@/lib/credits/engine'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Input de quantidade personalizada, compartilhado pelos 3 cards — só muda
 *  a unidade (créditos vs. reais) e o mínimo aceito. */
function CustomAmountRow({
  unit, min, placeholder, loading, onBuy,
}: {
  unit: 'créditos' | 'reais'
  min: number
  placeholder: string
  loading: boolean
  onBuy: (value: number) => void
}) {
  const [value, setValue] = useState('')

  function submit() {
    const n = Number(value)
    if (!n || n < min) {
      toast.error(unit === 'créditos' ? `Mínimo: ${min} créditos.` : `Valor mínimo: R$ ${min}.`)
      return
    }
    onBuy(n)
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        min={min}
        placeholder={placeholder}
        value={value}
        onChange={e => setValue(e.target.value)}
        className="h-7 text-xs flex-1 min-w-0"
        disabled={loading}
      />
      <Button size="sm" variant="outline" onClick={submit} disabled={loading} className="h-7 text-xs shrink-0">
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Comprar'}
      </Button>
    </div>
  )
}

/** Limiares de alerta de consumo (seção 16 do pedido de billing) — 50/75/90/100%. */
function creditAlert(pct: number): { level: 'ok' | 'warn' | 'critical' | 'empty'; message: string } | null {
  if (pct >= 100) return { level: 'empty', message: 'Seus Althos Credits acabaram este mês.' }
  if (pct >= 90) return { level: 'critical', message: 'Você já usou 90% dos seus Althos Credits deste ciclo.' }
  if (pct >= 75) return { level: 'critical', message: 'Você já usou 75% dos seus Althos Credits deste ciclo.' }
  if (pct >= 50) return { level: 'warn', message: 'Você já usou metade dos seus Althos Credits deste ciclo.' }
  return null
}

function AiCreditsCard({ orgSlug, data, packs }: { orgSlug: string; data: CreditsOverview['ai']; packs: CreditPackage[] }) {
  const [loading, setLoading] = useState(false)
  const total = data.available + data.used
  const pct = total > 0 ? (data.used / total) * 100 : 0
  const alert = creditAlert(pct)

  async function buyPack(packId: string) {
    setLoading(true)
    const res = await purchaseCreditPack(orgSlug, packId)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    window.location.href = res.checkoutUrl
  }

  async function buyCustom(credits: number) {
    setLoading(true)
    const res = await purchaseCustomCreditPack(orgSlug, credits)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    window.location.href = res.checkoutUrl
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Althos Credits</h3>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Disponível</span>
          <span className="font-medium tabular-nums">{data.available.toLocaleString('pt-BR')} créditos</span>
        </div>
        <Progress value={Math.min(pct, 100)} className={alert ? '[&>div]:bg-destructive' : ''} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{data.used.toLocaleString('pt-BR')} usados este mês</span>
          <span>{(data.included + data.purchased).toLocaleString('pt-BR')} total</span>
        </div>
      </div>
      {alert && (
        <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{alert.message}</span>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {packs.map(pack => (
          <Button key={pack.id} variant="outline" size="sm" onClick={() => buyPack(pack.id)} disabled={loading} className="gap-1.5 text-xs h-7">
            {pack.credits.toLocaleString('pt-BR')} — {formatPrice(pack.priceCents)}
          </Button>
        ))}
      </div>
      <div className="pt-2 border-t space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Quantidade personalizada (R$ {(ADDON_CREDIT_PRICE_CENTS / 100).toFixed(2)}/crédito)</p>
        <CustomAmountRow unit="créditos" min={MIN_CUSTOM_AI_CREDITS} placeholder={`Mín. ${MIN_CUSTOM_AI_CREDITS}`} loading={loading} onBuy={buyCustom} />
      </div>
    </div>
  )
}

function VoiceCreditsCard({ orgSlug, data }: { orgSlug: string; data: CreditsOverview['voice'] }) {
  const [loading, setLoading] = useState(false)
  const total = data.availableCents + data.usedCents
  const pct = total > 0 ? (data.usedCents / total) * 100 : 0

  async function buyPack(packId: typeof VOICE_CREDIT_PACKS[number]['id']) {
    setLoading(true)
    const res = await purchaseVoiceCredits(orgSlug, packId)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    if (res.paymentUrl) window.open(res.paymentUrl, '_blank')
    toast.success('Cobrança gerada — conclua o pagamento para liberar os créditos.')
  }

  async function buyCustom(valueReais: number) {
    setLoading(true)
    const res = await purchaseVoiceCreditsCustom(orgSlug, valueReais)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    if (res.paymentUrl) window.open(res.paymentUrl, '_blank')
    toast.success('Cobrança gerada — conclua o pagamento para liberar os créditos.')
  }

  if (!data.enabled) {
    return (
      <div className="rounded-none border bg-card p-5 space-y-2 opacity-60">
        <div className="flex items-center gap-2">
          <Phone className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">Voice Credits</h3>
        </div>
        <p className="text-xs text-muted-foreground">Althos Voice não está incluído no seu plano atual.</p>
      </div>
    )
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Phone className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Voice Credits</h3>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Disponível</span>
          <span className="font-medium tabular-nums">{formatCents(data.availableCents)}</span>
        </div>
        <Progress value={Math.min(pct, 100)} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{formatCents(data.usedCents)} usados este mês</span>
          <span>{formatCents(data.purchasedCents)} comprado</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {VOICE_CREDIT_PACKS.map(p => (
          <Button key={p.id} variant="outline" size="sm" onClick={() => buyPack(p.id)} disabled={loading} className="gap-1.5 text-xs h-7">
            {p.label}
          </Button>
        ))}
      </div>
      <div className="pt-2 border-t space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor personalizado</p>
        <CustomAmountRow unit="reais" min={MIN_CUSTOM_VOICE_REAIS} placeholder={`Mín. R$ ${MIN_CUSTOM_VOICE_REAIS}`} loading={loading} onBuy={buyCustom} />
      </div>
    </div>
  )
}

function EmailCreditsCard({ orgSlug, data }: { orgSlug: string; data: CreditsOverview['email'] }) {
  const [loading, setLoading] = useState(false)
  const total = data.availableCents + data.usedCents
  const pct = total > 0 ? (data.usedCents / total) * 100 : 0

  async function buyPack(packId: typeof EMAIL_CREDIT_PACKS[number]['id']) {
    setLoading(true)
    const res = await purchaseEmailCredits(orgSlug, packId)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    if (res.paymentUrl) window.open(res.paymentUrl, '_blank')
    toast.success('Cobrança gerada — conclua o pagamento para liberar os créditos.')
  }

  async function buyCustom(valueReais: number) {
    setLoading(true)
    const res = await purchaseEmailCreditsCustom(orgSlug, valueReais)
    setLoading(false)
    if (!res.ok) return toast.error(res.error)
    if (res.paymentUrl) window.open(res.paymentUrl, '_blank')
    toast.success('Cobrança gerada — conclua o pagamento para liberar os créditos.')
  }

  return (
    <div className="rounded-none border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Email Credits</h3>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Disponível</span>
          <span className="font-medium tabular-nums">{formatCents(data.availableCents)}</span>
        </div>
        <Progress value={Math.min(pct, 100)} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{formatCents(data.usedCents)} usados este mês</span>
          <span>{formatCents(data.purchasedCents)} comprado</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {EMAIL_CREDIT_PACKS.map(p => (
          <Button key={p.id} variant="outline" size="sm" onClick={() => buyPack(p.id)} disabled={loading} className="gap-1.5 text-xs h-7">
            {p.label}
          </Button>
        ))}
      </div>
      <div className="pt-2 border-t space-y-1">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Valor personalizado</p>
        <CustomAmountRow unit="reais" min={MIN_CUSTOM_EMAIL_REAIS} placeholder={`Mín. R$ ${MIN_CUSTOM_EMAIL_REAIS}`} loading={loading} onBuy={buyCustom} />
      </div>
    </div>
  )
}

export default function CreditsPurchaseSection({ orgSlug, overview, aiPacks }: { orgSlug: string; overview: CreditsOverview; aiPacks: CreditPackage[] }) {
  return (
    <div className="rounded-none border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-sm">Créditos de uso</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Saldo e compra avulsa — pacotes prontos ou quantidade personalizada, cada crédito com ledger próprio.
          Althos Credits são usados por recursos de IA (agente, resumo, classificação, extração). WhatsApp, Voice e Email têm consumo próprio, separado.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AiCreditsCard orgSlug={orgSlug} data={overview.ai} packs={aiPacks} />
        <VoiceCreditsCard orgSlug={orgSlug} data={overview.voice} />
        <EmailCreditsCard orgSlug={orgSlug} data={overview.email} />
      </div>
    </div>
  )
}
