'use client'

/**
 * Referrals + coupons UI for the subscription page. Reads come pre-fetched
 * from the server; mutations call the redeem* server actions.
 *
 * The share link points at public signup with ?ref=CODE so the referred user
 * carries the code through onboarding (wiring the signup capture is a separate
 * step; the link is already correct).
 */

import { useState, useTransition } from 'react'
import { Gift, Copy, Check, Ticket, Users, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { redeemCoupon, redeemReferral } from '@/actions/referrals'
import type { ReferralOverview, AppliedCoupon } from '@/actions/referrals'

function discountLabel(type: string, value: number) {
  if (type === 'percent') return `${value}% de desconto`
  if (type === 'fixed') return `R$ ${(value / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de desconto`
  return `${value}`
}

export default function ReferralCouponsSection({
  orgSlug,
  overview,
  appliedCoupons,
  canRefer = true,
}: {
  orgSlug: string
  overview: ReferralOverview
  appliedCoupons: AppliedCoupon[]
  /** Only paying customers can generate/share a referral link. Free-plan
   *  accounts still see (and can redeem) the coupon card. */
  canRefer?: boolean
}) {
  // Free plan: hide the referral link entirely, show only the coupon card in a
  // single column.
  if (!canRefer) {
    return (
      <div className="grid grid-cols-1 gap-6">
        <CouponCard orgSlug={orgSlug} applied={appliedCoupons} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <ReferralCard orgSlug={orgSlug} overview={overview} />
      <CouponCard orgSlug={orgSlug} applied={appliedCoupons} />
    </div>
  )
}

function ReferralCard({ orgSlug, overview }: { orgSlug: string; overview: ReferralOverview }) {
  const [copied, setCopied] = useState(false)
  const code = overview.referralCode

  const shareLink =
    typeof window !== 'undefined' && code
      ? `${window.location.origin}/signup?ref=${code}`
      : code
        ? `/signup?ref=${code}`
        : ''

  async function copy() {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — ignore */
    }
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Gift className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Indique e ganhe</h2>
          <p className="text-xs text-muted-foreground">
            Compartilhe seu link. A cada conta que assinar, você ganha recompensa.
          </p>
        </div>
      </div>

      {code ? (
        <>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Seu link de indicação</label>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shareLink}
                className="flex-1 rounded-lg border bg-muted/40 px-3 py-2 text-sm text-foreground/80 outline-none"
                onFocus={e => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={copy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Código: <span className="font-mono font-medium text-foreground">{code}</span>
            </p>
          </div>

          <div className="flex items-center gap-4 rounded-lg bg-muted/40 px-4 py-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-bold leading-none tabular-nums">{overview.totalReferred}</div>
                <div className="text-[11px] text-muted-foreground">Indicados</div>
              </div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="text-lg font-bold leading-none tabular-nums text-primary">
                {overview.convertedCount}
              </div>
              <div className="text-[11px] text-muted-foreground">Converteram</div>
            </div>
          </div>

          {overview.referred.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Suas indicações</p>
              <ul className="divide-y divide-border/60 rounded-lg border">
                {overview.referred.slice(0, 6).map(r => (
                  <li key={r.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="truncate">{r.name || 'Conta indicada'}</span>
                    <Badge variant={r.status === 'converted' || r.convertedAt ? 'default' : 'secondary'} className="text-[10px]">
                      {r.status === 'converted' || r.convertedAt ? 'Convertida' : 'Pendente'}
                    </Badge>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Seu código de indicação ainda não está disponível. Tente recarregar a página.
        </p>
      )}
    </div>
  )
}

function CouponCard({ orgSlug, applied }: { orgSlug: string; applied: AppliedCoupon[] }) {
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim() || pending) return
    setMsg(null)
    startTransition(async () => {
      const res = await redeemCoupon(orgSlug, code)
      if (res.ok) {
        setMsg({ ok: true, text: `Cupom ${res.code} aplicado: ${discountLabel(res.discountType, res.discountValue)}.` })
        setCode('')
      } else {
        setMsg({ ok: false, text: res.error })
      }
    })
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Ticket className="h-4.5 w-4.5" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Cupom de desconto</h2>
          <p className="text-xs text-muted-foreground">Tem um código? Resgate aqui.</p>
        </div>
      </div>

      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="EX: ALTHOS30"
          className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-primary/30"
          maxLength={40}
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {pending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Resgatar
        </button>
      </form>

      {msg && (
        <p className={`text-xs ${msg.ok ? 'text-primary' : 'text-destructive'}`}>{msg.text}</p>
      )}

      {applied.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Cupons aplicados</p>
          <ul className="divide-y divide-border/60 rounded-lg border">
            {applied.map(c => (
              <li key={c.code + (c.appliedAt ?? '')} className="flex items-center justify-between px-3 py-2 text-sm">
                <div className="min-w-0">
                  <span className="font-mono font-medium">{c.code}</span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {discountLabel(c.discountType, c.discountValue)}
                  </span>
                </div>
                {c.appliedAt && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(c.appliedAt).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
