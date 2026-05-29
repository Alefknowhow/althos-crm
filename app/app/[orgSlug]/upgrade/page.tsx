import { getCurrentOrganization } from '@/lib/supabase/types'
import { PUBLIC_PLANS, getPlan, formatPrice, isAccessBlocked } from '@/lib/billing/plans'
import UpgradeCheckoutButton from '@/components/features/billing/UpgradeCheckoutButton'
import { CheckCircle2, Zap, Users, Sparkles, Clock, XCircle, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const FEATURE_ROWS = [
  { label: 'Leads',           starter: 'até 500',   pro: 'Ilimitado' },
  { label: 'Pipeline Kanban', starter: '✓',          pro: '✓' },
  { label: 'Formulários',     starter: '✓',          pro: '✓' },
  { label: 'Tarefas',         starter: '✓',          pro: '✓' },
  { label: 'WhatsApp',        starter: '✓',          pro: '✓' },
  { label: 'Automações',      starter: '—',          pro: '✓' },
  { label: 'Score IA',        starter: '—',          pro: '✓' },
  { label: 'Insights IA',     starter: '—',          pro: '✓' },
  { label: 'Atendente IA',    starter: '—',          pro: '✓' },
]

export default async function UpgradePage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug) as any

  const blocked = isAccessBlocked({
    plan:                       org.plan ?? null,
    trial_ends_at:              org.trial_ends_at ?? null,
    subscription_status:        org.subscription_status ?? null,
    billing_managed_externally: org.billing_managed_externally ?? null,
  })

  const isTrial        = org.plan === 'trial' || org.plan === 'free_trial'
  const isTrialExpired = isTrial && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()
  const isCanceled     = org.subscription_status === 'canceled'

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-10">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        {isTrialExpired && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-1.5 text-sm font-semibold mb-2">
            <Clock className="w-4 h-4" /> Seu período de trial expirou
          </div>
        )}
        {isCanceled && (
          <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 text-destructive px-4 py-1.5 text-sm font-semibold mb-2">
            <XCircle className="w-4 h-4" /> Sua assinatura foi cancelada
          </div>
        )}
        {isTrial && !isTrialExpired && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4" /> Desbloqueie todo o potencial do Althos CRM
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight">
          Escolha o plano certo para você
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Sem fidelidade. Cancele quando quiser.
          Boleto, PIX ou Cartão de Crédito.
        </p>
      </div>

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {PUBLIC_PLANS.map(plan => {
          const isPro     = plan.key === 'pro'
          const isCurrent = org.plan === plan.key && org.subscription_status === 'active'

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-6 space-y-6 ${
                isPro
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold">
                  <Sparkles className="w-3 h-3" /> Mais popular
                </span>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  {isPro
                    ? <Zap className="w-5 h-5 text-primary" />
                    : <Users className="w-5 h-5 text-muted-foreground" />
                  }
                  <span className="font-semibold text-lg">{plan.label}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      Plano atual
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold tabular-nums">
                  {formatPrice(plan.priceCents!)}
                </span>
                <span className="text-muted-foreground mb-1">/mês</span>
              </div>

              <ul className="space-y-2 text-sm">
                {FEATURE_ROWS.map(row => {
                  const val = plan.key === 'starter' ? row.starter : row.pro
                  const has = val !== '—'
                  return (
                    <li key={row.label} className={`flex items-center gap-2 ${has ? '' : 'opacity-40'}`}>
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${has ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>{row.label}</span>
                      {val !== '✓' && val !== '—' && (
                        <span className="ml-auto text-xs text-muted-foreground">{val}</span>
                      )}
                    </li>
                  )
                })}
              </ul>

              {/* Opens the checkout modal with Boleto/PIX/Card choice */}
              <UpgradeCheckoutButton
                orgSlug={params.orgSlug}
                plan={plan.key as 'starter' | 'pro'}
                label={isCurrent ? 'Plano ativo' : `Assinar ${plan.label}`}
                disabled={isCurrent}
                highlight={isPro}
              />
            </div>
          )
        })}
      </div>

      {/* ── Feature comparison table ──────────────────────────────────────── */}
      <div className="rounded-xl border overflow-hidden">
        <div className="grid grid-cols-3 bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <span>Recurso</span>
          <span className="text-center">Starter</span>
          <span className="text-center">Pro</span>
        </div>
        {FEATURE_ROWS.map((row, i) => (
          <div
            key={row.label}
            className={`grid grid-cols-3 px-4 py-2.5 text-sm border-t ${i % 2 === 0 ? '' : 'bg-muted/20'}`}
          >
            <span className="font-medium">{row.label}</span>
            <span className={`text-center ${row.starter === '—' ? 'text-muted-foreground' : 'text-primary'}`}>
              {row.starter}
            </span>
            <span className={`text-center font-medium ${row.pro === '—' ? 'text-muted-foreground' : 'text-primary'}`}>
              {row.pro}
            </span>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-xs text-muted-foreground">
          Pagamento via Boleto, PIX ou Cartão de Crédito · Renovação mensal automática · Sem fidelidade
        </p>
        <Link
          href={`/app/${params.orgSlug}/configuracoes/assinatura`}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver detalhes da assinatura atual <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  )
}
