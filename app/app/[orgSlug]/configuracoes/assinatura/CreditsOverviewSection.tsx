'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Loader2, Sparkles, Phone, Mail } from 'lucide-react'
import { purchaseCreditPack } from '@/actions/addons'
import { purchaseVoiceCredits } from '@/actions/voice'
import { purchaseEmailCredits } from '@/actions/email-credits'
import { CREDIT_PACKS } from '@/lib/plans/config'
import { VOICE_CREDIT_PACKS } from '@/lib/voice/credit-packs'
import { EMAIL_CREDIT_PACKS } from '@/lib/email/credit-packs'
import { formatPrice } from '@/lib/billing/plans'
import type { CreditsOverview, CreditLedgerRow } from '@/actions/billing-credits-overview'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function MiniHistory({ rows, formatAmount }: { rows: CreditLedgerRow[]; formatAmount: (n: number) => string }) {
  if (rows.length === 0) return <p className="text-xs text-muted-foreground">Nenhum consumo ainda.</p>
  return (
    <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
      {rows.map(r => (
        <div key={r.id} className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground truncate pr-2">{r.detail}</span>
          <span className={`tabular-nums shrink-0 ${r.type === 'purchased' ? 'text-emerald-600' : 'text-muted-foreground'}`}>
            {r.type === 'purchased' ? '+' : '-'}{formatAmount(Math.abs(r.amount))}
          </span>
        </div>
      ))}
    </div>
  )
}

function AiCreditsCard({ orgSlug, data }: { orgSlug: string; data: CreditsOverview['ai'] }) {
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null)
  const total = data.available + data.used
  const pct = total > 0 ? (data.used / total) * 100 : 0

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
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-sm">Créditos de IA</h3>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Disponível</span>
          <span className="font-medium tabular-nums">{data.available.toLocaleString('pt-BR')} créditos</span>
        </div>
        <Progress value={Math.min(pct, 100)} />
        <div className="flex justify-between text-[11px] text-muted-foreground">
          <span>{data.used.toLocaleString('pt-BR')} usados este mês</span>
          <span>{(data.included + data.purchased).toLocaleString('pt-BR')} total</span>
        </div>
      </div>
      <MiniHistory rows={data.transactions} formatAmount={n => `${n} créd.`} />
      <div className="flex flex-wrap gap-1.5 pt-1">
        {CREDIT_PACKS.map((pack, i) => (
          <Button key={pack.credits} variant="outline" size="sm" onClick={() => buy(i)} disabled={loadingIdx !== null} className="gap-1.5 text-xs h-7">
            {loadingIdx === i ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {pack.credits.toLocaleString('pt-BR')} — {formatPrice(pack.priceCents)}
          </Button>
        ))}
      </div>
    </div>
  )
}

function VoiceCreditsCard({ orgSlug, data }: { orgSlug: string; data: CreditsOverview['voice'] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const total = data.availableCents + data.usedCents
  const pct = total > 0 ? (data.usedCents / total) * 100 : 0

  async function buy(packId: typeof VOICE_CREDIT_PACKS[number]['id']) {
    setLoadingId(packId)
    const res = await purchaseVoiceCredits(orgSlug, packId)
    setLoadingId(null)
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
      <MiniHistory rows={data.transactions} formatAmount={n => formatCents(n)} />
      <div className="flex flex-wrap gap-1.5 pt-1">
        {VOICE_CREDIT_PACKS.map(p => (
          <Button key={p.id} variant="outline" size="sm" onClick={() => buy(p.id)} disabled={loadingId !== null} className="gap-1.5 text-xs h-7">
            {loadingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

function EmailCreditsCard({ orgSlug, data }: { orgSlug: string; data: CreditsOverview['email'] }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const total = data.availableCents + data.usedCents
  const pct = total > 0 ? (data.usedCents / total) * 100 : 0

  async function buy(packId: typeof EMAIL_CREDIT_PACKS[number]['id']) {
    setLoadingId(packId)
    const res = await purchaseEmailCredits(orgSlug, packId)
    setLoadingId(null)
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
      <MiniHistory rows={data.transactions} formatAmount={n => formatCents(n)} />
      <div className="flex flex-wrap gap-1.5 pt-1">
        {EMAIL_CREDIT_PACKS.map(p => (
          <Button key={p.id} variant="outline" size="sm" onClick={() => buy(p.id)} disabled={loadingId !== null} className="gap-1.5 text-xs h-7">
            {loadingId === p.id ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            {p.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

export default function CreditsOverviewSection({ orgSlug, overview }: { orgSlug: string; overview: CreditsOverview }) {
  return (
    <div className="rounded-none border bg-card p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-sm">Créditos de uso</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Saldo, consumo do mês e compra avulsa — cada crédito tem ledger próprio, nunca compartilha saldo entre si.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <AiCreditsCard orgSlug={orgSlug} data={overview.ai} />
        <VoiceCreditsCard orgSlug={orgSlug} data={overview.voice} />
        <EmailCreditsCard orgSlug={orgSlug} data={overview.email} />
      </div>
    </div>
  )
}
