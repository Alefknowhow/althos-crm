import { getCurrentOrganization } from '@/lib/supabase/types'
import { PUBLIC_PLANS, getPlan, formatPrice, isAccessBlocked } from '@/lib/billing/plans'
import UpgradeCheckoutButton from '@/components/features/billing/UpgradeCheckoutButton'
import { CheckCircle2, XCircle, Sparkles, Clock, AlertCircle, Zap, Users, Rocket } from 'lucide-react'
import Link from 'next/link'

const FEATURE_ROWS: { label: string; starter: boolean | string; pro: boolean | string; scale: boolean | string }[] = [
  { label: 'Leads e clientes',             starter: 'Ilimitados',  pro: 'Ilimitados',  scale: 'Ilimitados'  },
  { label: 'Oportunidades e pipeline',      starter: '✓',           pro: '✓',           scale: '✓'           },
  { label: 'Formulários de captação',       starter: '✓',           pro: '✓',           scale: '✓'           },
  { label: 'WhatsApp centralizado',         starter: '✓',           pro: '✓',           scale: '✓'           },
  { label: 'Tarefas e agendamentos',        starter: '✓',           pro: '✓',           scale: '✓'           },
  { label: 'Catálogo de produtos',          starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Atendimento com IA 24/7',       starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Score e qualificação por IA',   starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Insights de vendas com IA',     starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Follow-up automático',          starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Instagram (DMs + comentários)', starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Meta Ads + Google Ads',         starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'Pixel e CAPI',                  starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'E-mail marketing',              starter: '—',           pro: '✓',           scale: '✓'           },
  { label: 'IA avançada e previsões',       starter: '—',           pro: '—',           scale: '✓'           },
  { label: 'Painéis personalizados',        starter: '—',           pro: '—',           scale: '✓'           },
  { label: 'API aberta e webhooks',         starter: '—',           pro: '—',           scale: '✓'           },
  { label: 'Usuários',                      starter: '1 usuário',   pro: 'Até 5',       scale: 'Ilimitado'   },
  { label: 'Gerente de conta dedicado',     starter: '—',           pro: '—',           scale: '✓'           },
  { label: 'Suporte',                       starter: 'E-mail',      pro: 'Prioritário', scale: 'VIP'         },
]

const PLAN_ICONS: Record<string, React.ElementType> = {
  starter: Users,
  pro:     Zap,
  scale:   Rocket,
}

function FeatureCell({ val }: { val: boolean | string }) {
  if (val === '✓' || val === true)  return <CheckCircle2 className="w-4 h-4 text-primary mx-auto" />
  if (val === '—' || val === false) return <span className="text-muted-foreground/40 mx-auto block text-center">—</span>
  return <span className="text-xs font-medium text-primary text-center block">{val}</span>
}

export default async function UpgradePage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug) as any

  const isTrial        = org.plan === 'trial' || org.plan === 'free_trial'
  const isTrialExpired = isTrial && org.trial_ends_at && new Date(org.trial_ends_at) < new Date()
  const isCanceled     = org.subscription_status === 'canceled'

  return (
    <div className="max-w-5xl mx-auto py-10 px-4 space-y-10">

      {/* ── Banner ─────────────────────────────────────────────────────────── */}
      <div className="text-center space-y-3">
        {isTrialExpired && (
          <div className="inline-flex items-center gap-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-4 py-1.5 text-sm font-semibold mb-2">
            <Clock className="w-4 h-4" /> Seu período de trial expirou
          </div>
        )}
        {isCanceled && (
          <div className="inline-flex items-center gap-2 rounded-full bg-destructive/10 text-destructive px-4 py-1.5 text-sm font-semibold mb-2">
            <AlertCircle className="w-4 h-4" /> Sua assinatura foi cancelada
          </div>
        )}
        {isTrial && !isTrialExpired && (
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 text-primary px-4 py-1.5 text-sm font-semibold mb-2">
            <Sparkles className="w-4 h-4" /> Desbloqueie todo o potencial do Althos CRM
          </div>
        )}

        <h1 className="text-3xl font-bold tracking-tight">
          Escolha o plano ideal para vender mais.
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Sem fidelidade. Cancele quando quiser.
          Boleto, PIX ou Cartão de Crédito.
        </p>
      </div>

      {/* ── Plan cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PUBLIC_PLANS.map(plan => {
          const isPro     = plan.key === 'pro'
          const isScale   = plan.key === 'scale'
          const isCurrent = org.plan === plan.key && org.subscription_status === 'active'
          const Icon      = PLAN_ICONS[plan.key] ?? Zap
          const features  = FEATURE_ROWS.map(r => ({
            label: r.label,
            val: r[plan.key as 'starter' | 'pro' | 'scale'],
          }))

          return (
            <div
              key={plan.key}
              className={`relative rounded-2xl border p-6 space-y-5 flex flex-col ${
                isPro
                  ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
                  : 'border-border bg-card'
              }`}
            >
              {isPro && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-xs font-semibold whitespace-nowrap">
                  <Sparkles className="w-3 h-3" /> Mais popular
                </span>
              )}

              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-5 h-5 ${isPro ? 'text-primary' : isScale ? 'text-violet-500' : 'text-muted-foreground'}`} />
                  <span className="font-bold text-lg">{plan.label}</span>
                  {isCurrent && (
                    <span className="ml-auto text-[10px] font-medium bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                      Plano atual
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                <p className="text-[13px] text-muted-foreground mt-1 leading-snug">{plan.description}</p>
              </div>

              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold tabular-nums">
                  {formatPrice(plan.priceCents!)}
                </span>
                <span className="text-muted-foreground mb-1">/mês</span>
              </div>

              <ul className="space-y-1.5 text-sm flex-1">
                {features.filter(f => f.val !== '—' && f.val !== false).map(f => (
                  <li key={f.label} className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                    <span>
                      {f.label}
                      {typeof f.val === 'string' && f.val !== '✓' && (
                        <span className="ml-1 text-xs font-medium text-primary">({f.val})</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>

              <UpgradeCheckoutButton
                orgSlug={params.orgSlug}
                plan={plan.key as 'starter' | 'pro' | 'scale'}
                label={isCurrent ? 'Plano ativo' : `Assinar ${plan.label}`}
                disabled={isCurrent}
                highlight={isPro}
              />
            </div>
          )
        })}
      </div>

      {/* ── Feature comparison table ──────────────────────────────────────── */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Comparativo completo</h2>
        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-4 bg-muted/50 px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b">
            <span>Recurso</span>
            <span className="text-center">Starter</span>
            <span className="text-center text-primary">Pro</span>
            <span className="text-center text-violet-500">Scale</span>
          </div>
          {FEATURE_ROWS.map((row, i) => (
            <div
              key={row.label}
              className={`grid grid-cols-4 items-center px-4 py-2.5 text-sm border-t ${i % 2 !== 0 ? 'bg-muted/20' : ''}`}
            >
              <span className="font-medium text-foreground/80">{row.label}</span>
              <FeatureCell val={row.starter} />
              <FeatureCell val={row.pro} />
              <FeatureCell val={row.scale} />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-2">
        <p className="text-center text-xs text-muted-foreground">
          Pagamento via Boleto, PIX ou Cartão de Crédito · Renovação mensal automática · Sem fidelidade
        </p>
        <Link
          href={`/app/${params.orgSlug}/configuracoes/assinatura`}
          className="text-xs text-primary hover:underline inline-flex items-center gap-1"
        >
          Ver detalhes da assinatura atual →
        </Link>
      </div>
    </div>
  )
}
