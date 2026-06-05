import { getCurrentOrganization } from '@/lib/supabase/types'
import { getPlan, formatPrice } from '@/lib/billing/plans'
import { getUsageStatus, getTrialDaysRemaining } from '@/lib/billing/limits'
import { asaas } from '@/lib/asaas/client'
import SubscriptionActions from './SubscriptionActions'
import ReferralCouponsSection from '@/components/features/billing/ReferralCouponsSection'
import { getReferralOverview, getAppliedCoupons } from '@/actions/referrals'
import { getSubscriptionByOrgSlug } from '@/lib/plans/server'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Zap, Users, Mail, MessageSquare, Calendar, AlertCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import SettingsTabsNav from '../SettingsTabsNav'

function statusLabel(status: string | null) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    active:    { label: 'Ativo',        variant: 'default' },
    trialing:  { label: 'Trial',        variant: 'secondary' },
    no_billing:{ label: 'Sem cobrança', variant: 'outline' },
    past_due:  { label: 'Vencido',      variant: 'destructive' },
    canceled:  { label: 'Cancelado',    variant: 'destructive' },
  }
  return map[status ?? 'no_billing'] ?? { label: status ?? '—', variant: 'outline' as const }
}

export default async function SubscriptionPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug) as any

  if (org.account_type === 'internal') redirect(`/app/${params.orgSlug}`)

  const plan        = getPlan(org.plan)
  const usage       = await getUsageStatus(org.id)
  const trialDays   = await getTrialDaysRemaining(org.id)
  const status      = statusLabel(org.subscription_status)
  const isTrial     = org.plan === 'trial' || org.plan === 'free_trial'
  const isActive    = org.subscription_status === 'active'
  const isManaged   = org.billing_managed_externally === true

  // Fetch invoice history from Asaas (best-effort — no crash if API is down)
  let invoices: any[] = []
  if (org.asaas_customer_id && !isManaged) {
    try {
      const result = await asaas.getInvoices(org.asaas_customer_id)
      invoices = (result?.data as any[]) ?? []
    } catch { /* offline or no key */ }
  }

  // Referrals + coupons (new per-account system).
  const [referralOverview, appliedCoupons, subscription] = await Promise.all([
    getReferralOverview(params.orgSlug),
    getAppliedCoupons(params.orgSlug),
    getSubscriptionByOrgSlug(params.orgSlug),
  ])

  // Referral program is paid-only: free-plan accounts can redeem coupons but
  // cannot generate/share their own referral link. A customer counts as paying
  // if they have an active/trialing paid subscription, a legacy paid plan, or
  // billing managed externally by Althos.
  const PAID_LEGACY = new Set(['starter', 'pro', 'business', 'scale', 'agency'])
  const canRefer =
    (subscription?.isActive === true && subscription.planId !== 'free') ||
    PAID_LEGACY.has(org.plan ?? '') ||
    isManaged

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <div className="space-y-6 max-w-3xl">
      {/* ── Plan + Status card ─────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Zap className="w-5 h-5 shrink-0 text-primary" />
              <span className="text-xl font-bold">{plan.label}</span>
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          </div>

          {plan.priceCents !== null && (
            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-bold tabular-nums whitespace-nowrap">{formatPrice(plan.priceCents)}</div>
              <div className="text-xs text-muted-foreground">/mês</div>
            </div>
          )}
        </div>

        {/* Trial progress */}
        {isTrial && trialDays !== null && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Período de trial (7 dias)</span>
              <span className={trialDays <= 2 ? 'text-destructive font-medium' : ''}>
                {trialDays === 0 ? 'Expirado' : `${trialDays} dia${trialDays !== 1 ? 's' : ''} restante${trialDays !== 1 ? 's' : ''}`}
              </span>
            </div>
            <Progress
              value={trialDays === 0 ? 100 : ((7 - trialDays) / 7) * 100}
              className={trialDays <= 2 ? '[&>div]:bg-destructive' : ''}
            />
          </div>
        )}

        {/* Renewal date */}
        {isActive && org.current_period_end && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              Próxima cobrança: <strong className="text-foreground">
                {new Date(org.current_period_end).toLocaleDateString('pt-BR')}
              </strong>
            </span>
          </div>
        )}

        {/* Managed note */}
        {isManaged && (
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Sua assinatura é gerenciada pela Althos. Entre em contato para alterações.</span>
          </div>
        )}

        {/* Actions: upgrade / cancel */}
        {!isManaged && (
          <SubscriptionActions
            orgSlug={params.orgSlug}
            currentPlan={org.plan as 'starter' | 'pro' | 'business' | 'scale' | 'free' | 'trial' | 'free_trial' | null}
            subscriptionStatus={org.subscription_status}
          />
        )}
      </div>

      {/* ── Usage card ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="font-semibold text-sm">Uso atual</h2>

        <UsageRow
          icon={<Users className="w-4 h-4" />}
          label="Leads cadastrados"
          used={usage.leads.used}
          limit={usage.leads.limit}
          pct={usage.leads.pct}
        />
        <UsageRow
          icon={<MessageSquare className="w-4 h-4" />}
          label="WhatsApp este mês"
          used={usage.whatsapp.used}
          limit={usage.whatsapp.limit}
          pct={usage.whatsapp.pct}
        />
        <UsageRow
          icon={<Mail className="w-4 h-4" />}
          label="E-mails este mês"
          used={usage.email.used}
          limit={usage.email.limit}
          pct={usage.email.pct}
        />
        <UsageRow
          icon={<Users className="w-4 h-4" />}
          label="Usuários na conta"
          used={usage.users.used}
          limit={usage.users.limit}
          pct={usage.users.pct}
        />
      </div>

      {/* ── Indicações + Cupons (sistema novo por Conta) ──────────────────── */}
      <ReferralCouponsSection
        orgSlug={params.orgSlug}
        overview={referralOverview}
        appliedCoupons={appliedCoupons}
        canRefer={canRefer}
      />

      {/* ── Invoice history ───────────────────────────────────────────────── */}
      {!isManaged && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold text-sm">Histórico de faturas</h2>
          </div>
          {invoices.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-muted-foreground">
              Nenhuma fatura encontrada.
            </div>
          ) : (
            <div className="divide-y">
              {invoices.slice(0, 12).map((inv: any) => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3 text-sm">
                  <div className="space-y-0.5">
                    <p className="font-medium">
                      {new Date(inv.dueDate).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {inv.billingType?.toLowerCase()} · vence {new Date(inv.dueDate).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {Number(inv.value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <Badge variant={inv.status === 'RECEIVED' || inv.status === 'CONFIRMED' ? 'default' : inv.status === 'OVERDUE' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {inv.status === 'RECEIVED' || inv.status === 'CONFIRMED' ? 'Pago'
                        : inv.status === 'OVERDUE'  ? 'Vencido'
                        : inv.status === 'PENDING'  ? 'Pendente'
                        : inv.status}
                    </Badge>
                    {inv.invoiceUrl && (
                      <a
                        href={inv.invoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  )
}

function UsageRow({
  icon, label, used, limit, pct,
}: {
  icon: React.ReactNode
  label: string
  used: number
  limit: number
  pct: number
}) {
  const isUnlimited = !isFinite(limit)
  const isHigh = pct >= 80

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span>{label}</span>
        </div>
        <span className={`font-medium tabular-nums ${isHigh ? 'text-destructive' : ''}`}>
          {used.toLocaleString('pt-BR')}
          {!isUnlimited && ` / ${limit.toLocaleString('pt-BR')}`}
          {isUnlimited && ' / ∞'}
        </span>
      </div>
      {!isUnlimited && (
        <Progress
          value={Math.min(pct, 100)}
          className={isHigh ? '[&>div]:bg-destructive' : ''}
        />
      )}
    </div>
  )
}
