'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCheckoutSession } from '@/actions/billing'
import { PLANS, getPlanPricing, ANNUAL_DISCOUNT_PCT, SEMESTRAL_DISCOUNT_PCT, type BillingCycle } from '@/lib/billing/plans'
import { toast } from 'sonner'
import { Loader2, QrCode, CreditCard, CheckCircle2, XCircle, Zap, Users, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

type Plan    = 'starter' | 'pro' | 'business'
type Method  = 'PIX' | 'CREDIT_CARD'

interface Props {
  orgSlug:     string
  open:        boolean
  onClose:     () => void
  initialPlan: Plan
}

// ── Plan feature matrix ───────────────────────────────────────────────────────

// Starter, Pro e Business têm as MESMAS funcionalidades — a diferença está na
// QUANTIDADE de uso de cada coisa. Dois recursos premium (Insights IA e
// Exportar relatórios) ficam reservados a Pro/Business.
const PLAN_FEATURES: {
  label:    string
  starter:  boolean | string
  pro:      boolean | string
  business: boolean | string
}[] = [
  // ── Quantidades ──
  { label: 'Usuários incluídos',                 starter: '1',            pro: 'Até 6',        business: 'Ilimitados' },
  { label: 'Empresas / orgs',                    starter: '1',            pro: 'Até 5',        business: 'Ilimitadas' },
  { label: 'Pipelines',                          starter: '2',            pro: '5',            business: 'Ilimitados' },
  { label: 'Leads no pipeline',                  starter: 'Ilimitados',   pro: 'Ilimitados',   business: 'Ilimitados' },
  { label: 'Clientes cadastrados',               starter: '500',          pro: '2.000',        business: 'Ilimitados' },
  { label: 'Créditos de IA / mês',               starter: '300',          pro: '1.200',        business: '3.000'      },
  { label: 'Automações ativas',                  starter: '5',            pro: '20',           business: 'Ilimitadas' },
  { label: 'Disparos de automação / mês',        starter: '1.000',        pro: '10.000',       business: 'Ilimitados' },
  { label: 'Contas de social (DM)',              starter: '1',            pro: '3',            business: 'Ilimitadas' },
  { label: 'Mensagens de social / mês',          starter: '500',          pro: '5.000',        business: 'Ilimitadas' },
  // ── Funcionalidades (iguais em todos) ──
  { label: 'Formulários de captação',            starter: true,           pro: true,           business: true         },
  { label: 'WhatsApp centralizado',              starter: true,           pro: true,           business: true         },
  { label: 'Catálogo de produtos',               starter: true,           pro: true,           business: true         },
  { label: 'Tarefas e atividades',               starter: true,           pro: true,           business: true         },
  { label: 'Agendamentos online',                starter: true,           pro: true,           business: true         },
  { label: 'Atendimento com IA 24/7',            starter: true,           pro: true,           business: true         },
  { label: 'Score e qualificação por IA',        starter: true,           pro: true,           business: true         },
  { label: 'Instagram (DMs e comentários)',      starter: true,           pro: true,           business: true         },
  { label: 'Meta Ads + Pixel/CAPI',              starter: true,           pro: true,           business: true         },
  // ── Premium (Pro/Business) ──
  { label: 'Insights de vendas com IA',          starter: false,          pro: true,           business: true         },
  { label: 'Exportar relatórios',                starter: false,          pro: true,           business: true         },
  { label: 'Gerente de conta dedicado',          starter: false,          pro: false,          business: true         },
]

const PLAN_INFO: Record<Plan, {
  label:    string
  tagline:  string
  icon:     React.ComponentType<{ className?: string }>
  popular?: boolean
}> = {
  starter: {
    label:    'Starter',
    tagline:  'Ideal para começar',
    icon:     Users,
  },
  pro: {
    label:    'Pro',
    tagline:  'Para crescer',
    icon:     Zap,
    popular:  true,
  },
  business: {
    label:    'Business',
    tagline:  'Para escalar sem limites',
    icon:     Rocket,
  },
}

const METHODS: { id: Method; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'PIX',         label: 'PIX',              desc: 'Aprovação instantânea.',       icon: QrCode     },
  { id: 'CREDIT_CARD', label: 'Cartão de Crédito', desc: 'Cobrança mensal automática.', icon: CreditCard },
]

const ALL_PLANS: Plan[] = ['starter', 'pro', 'business']

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutModal({ orgSlug, open, onClose, initialPlan }: Props) {
  const [plan,    setPlan]    = useState<Plan>(initialPlan)
  const [method,  setMethod]  = useState<Method>('PIX')
  const [cycle,   setCycle]   = useState<BillingCycle>('annual')
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    const res = await createCheckoutSession(
      orgSlug,
      plan,
      method,
      cycle === 'annual' ? 'YEARLY' : cycle === 'semestral' ? 'SEMIANNUALLY' : 'MONTHLY',
    )
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    window.location.href = res.checkoutUrl
  }

  const info     = PLAN_INFO[plan]
  const pricing  = getPlanPricing(PLANS[plan], cycle)

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinar plano</DialogTitle>
          <DialogDescription>
            Escolha o plano, o ciclo e a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        {/* ── Billing cycle toggle ── */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <div className="inline-flex items-center rounded-full border bg-muted/40 p-1">
            {(['monthly', 'semestral', 'annual'] as BillingCycle[]).map(c => (
              <button
                key={c}
                onClick={() => setCycle(c)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-xs font-semibold transition-all',
                  cycle === c ? 'bg-primary text-primary-foreground shadow' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {c === 'monthly' ? 'Mensal' : c === 'semestral' ? 'Semestral' : 'Anual'}
              </button>
            ))}
          </div>
          {cycle !== 'monthly' && (
            <Badge variant="secondary" className="text-[10px]">
              Economize {cycle === 'annual' ? ANNUAL_DISCOUNT_PCT : SEMESTRAL_DISCOUNT_PCT}% no {cycle === 'annual' ? 'anual' : 'semestral'}
            </Badge>
          )}
        </div>

        {/* ── Plan selector ── */}
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2.5">
          {ALL_PLANS.map(p => {
            const pi      = PLAN_INFO[p]
            const Icon    = pi.icon
            const active  = plan === p
            const pPrice  = getPlanPricing(PLANS[p], cycle)

            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  'relative rounded-xl border-2 p-2.5 sm:p-4 text-left transition-all flex flex-col gap-2 sm:gap-2.5 min-w-0',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {pi.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground px-2 sm:px-3 py-0.5 text-[9px] sm:text-[10px] font-semibold whitespace-nowrap">
                    Mais popular
                  </span>
                )}

                <div className="flex items-start justify-between gap-1 mt-1">
                  <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
                    <Icon className={cn('w-4 h-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="font-semibold text-xs sm:text-sm truncate">{pi.label}</span>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </div>

                <div className="flex items-end gap-0.5 sm:gap-1 min-w-0 flex-wrap">
                  <span className={cn('text-base sm:text-xl font-bold tabular-nums whitespace-nowrap', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {pPrice.perMonthLabel}
                  </span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground mb-0.5 whitespace-nowrap">/mês</span>
                </div>
                {cycle !== 'monthly' && (
                  <p className="text-[10px] text-muted-foreground -mt-1.5 truncate">
                    {pPrice.totalLabel}/{cycle === 'annual' ? 'ano' : 'semestre'}
                  </p>
                )}

                <p className="text-[11px] sm:text-xs text-muted-foreground leading-snug">{pi.tagline}</p>
              </button>
            )
          })}
        </div>

        {/* ── Feature comparison for selected plan ── */}
        <div className="rounded-xl border overflow-hidden">
          <div className="grid grid-cols-4 bg-muted/50 px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide border-b">
            <span className="col-span-1">Recurso</span>
            <span className="text-center">Starter</span>
            <span className="text-center text-primary">Pro</span>
            <span className="text-center" style={{ color: '#7C3AED' }}>Business</span>
          </div>
          {PLAN_FEATURES.map((feat, i) => (
            <div
              key={feat.label}
              className={cn('grid grid-cols-4 items-center px-4 py-2 text-xs border-t', i % 2 !== 0 && 'bg-muted/20')}
            >
              <span className="font-medium text-foreground/80 col-span-1">{feat.label}</span>
              {(['starter', 'pro', 'business'] as Plan[]).map(p => {
                const val = feat[p]
                const has = val !== false
                const isSelected = p === plan
                return (
                  <div key={p} className={cn('text-center', isSelected && 'font-semibold')}>
                    {typeof val === 'string' ? (
                      <span className={cn('text-[11px]', has ? (isSelected ? 'text-primary' : 'text-muted-foreground') : 'text-muted-foreground/40')}>
                        {val}
                      </span>
                    ) : has ? (
                      <CheckCircle2 className={cn('w-3.5 h-3.5 mx-auto', isSelected ? 'text-primary' : 'text-muted-foreground/60')} />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 mx-auto text-muted-foreground/25" />
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ── Payment method selector ── */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Forma de pagamento</p>
          {METHODS.map(m => {
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'w-full rounded-lg border-2 p-3 flex items-center gap-3 text-left transition-all',
                  method === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Icon className={cn('w-4 h-4 shrink-0', method === m.id ? 'text-primary' : 'text-muted-foreground')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.id === 'PIX' && (
                      <Badge variant="secondary" className="text-[10px] py-0">Recomendado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cycle !== 'monthly'
                      ? m.id === 'CREDIT_CARD'
                        ? `Parcele o valor ${cycle === 'annual' ? 'anual' : 'semestral'} no cartão.`
                        : `Pagamento ${cycle === 'annual' ? 'anual' : 'semestral'} à vista.`
                      : m.desc}
                  </p>
                </div>
                {method === m.id && (
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Summary + CTA ── */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
          <div>
            <span className="text-muted-foreground">
              {cycle === 'annual' ? 'Total anual' : cycle === 'semestral' ? 'Total semestral' : 'Total mensal'} — {info.label}
            </span>
            {cycle !== 'monthly' && (
              <p className="text-[11px] text-emerald-600">
                Economia de {pricing.savedLabel} no {cycle === 'annual' ? 'ano' : 'semestre'} · equivale a {pricing.perMonthLabel}/mês
              </p>
            )}
          </div>
          <span className="font-bold text-base shrink-0 tabular-nums whitespace-nowrap">{pricing.totalLabel}</span>
        </div>

        <Button
          onClick={handlePay}
          disabled={loading}
          className="w-full h-11"
          size="lg"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Aguarde...</>
            : `Continuar para pagamento →`
          }
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Você será redirecionado para a página segura do Asaas.
          Sem fidelidade — cancele quando quiser.
        </p>
      </DialogContent>
    </Dialog>
  )
}
