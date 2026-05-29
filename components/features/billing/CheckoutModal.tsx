'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCheckoutSession } from '@/actions/billing'
import { toast } from 'sonner'
import { Loader2, FileText, QrCode, CreditCard, CheckCircle2, XCircle, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type Plan    = 'starter' | 'pro'
type Method  = 'BOLETO' | 'PIX' | 'CREDIT_CARD'

interface Props {
  orgSlug:     string
  open:        boolean
  onClose:     () => void
  initialPlan: Plan
}

// ── Plan feature matrix ───────────────────────────────────────────────────────

const PLAN_FEATURES: {
  label:   string
  starter: boolean | string
  pro:     boolean | string
}[] = [
  { label: 'Pipeline Kanban',          starter: true,          pro: true         },
  { label: 'Leads',                    starter: 'Até 500',     pro: 'Ilimitados' },
  { label: 'Formulários de captação',  starter: true,          pro: true         },
  { label: 'WhatsApp unificado',        starter: true,          pro: true         },
  { label: 'Automações',               starter: true,          pro: true         },
  { label: 'Meta Pixel + CAPI',        starter: true,          pro: true         },
  { label: 'Score IA',                 starter: false,         pro: true         },
  { label: 'Insights IA',             starter: false,         pro: true         },
  { label: 'Atendente IA (WhatsApp)',  starter: false,         pro: true         },
]

const PLAN_INFO = {
  starter: {
    label:    'Starter',
    price:    'R$ 197/mês',
    priceFmt: 'R$ 197',
    color:    'text-foreground',
    icon:     Users,
    desc:     'Para times em crescimento',
  },
  pro: {
    label:    'Pro',
    price:    'R$ 397/mês',
    priceFmt: 'R$ 397',
    color:    'text-primary',
    icon:     Zap,
    desc:     'Com IA e leads ilimitados',
  },
}

const METHODS: { id: Method; label: string; desc: string; icon: React.ComponentType<any> }[] = [
  { id: 'PIX',         label: 'PIX',              desc: 'Aprovação instantânea.',              icon: QrCode     },
  { id: 'BOLETO',      label: 'Boleto Bancário',   desc: 'Vencimento em 1 dia útil.',          icon: FileText   },
  { id: 'CREDIT_CARD', label: 'Cartão de Crédito', desc: 'Cobrança mensal automática.',        icon: CreditCard },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function CheckoutModal({ orgSlug, open, onClose, initialPlan }: Props) {
  const [plan,    setPlan]    = useState<Plan>(initialPlan)
  const [method,  setMethod]  = useState<Method>('PIX')
  const [loading, setLoading] = useState(false)

  async function handlePay() {
    setLoading(true)
    const res = await createCheckoutSession(orgSlug, plan, method)
    setLoading(false)

    if (!res.ok) {
      toast.error(res.error)
      return
    }

    window.location.href = res.checkoutUrl
  }

  const info = PLAN_INFO[plan]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinar plano</DialogTitle>
          <DialogDescription>
            Escolha o plano e a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        {/* ── Plan selector with feature comparison ── */}
        <div className="grid grid-cols-2 gap-3">
          {(['starter', 'pro'] as Plan[]).map(p => {
            const pi      = PLAN_INFO[p]
            const Icon    = pi.icon
            const active  = plan === p
            const isPro   = p === 'pro'

            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  'relative rounded-xl border-2 p-4 text-left transition-all flex flex-col gap-3',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {/* Popular badge */}
                {isPro && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                    Mais popular
                  </span>
                )}

                {/* Plan header */}
                <div className="flex items-start justify-between gap-2 mt-1">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('w-4 h-4', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="font-semibold text-sm">{pi.label}</span>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </div>

                {/* Price */}
                <div className="flex items-end gap-1">
                  <span className={cn('text-2xl font-bold tabular-nums', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {pi.priceFmt}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">/mês</span>
                </div>

                <p className="text-xs text-muted-foreground -mt-1">{pi.desc}</p>

                {/* Feature list */}
                <ul className="flex flex-col gap-1.5 border-t pt-3">
                  {PLAN_FEATURES.map(feat => {
                    const val = p === 'starter' ? feat.starter : feat.pro
                    const has = val !== false

                    return (
                      <li key={feat.label} className="flex items-start gap-2">
                        {has ? (
                          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-muted-foreground/40" />
                        )}
                        <span className={cn('text-xs leading-snug', !has && 'text-muted-foreground/50 line-through')}>
                          {feat.label}
                          {typeof val === 'string' && (
                            <span className="ml-1 font-medium text-primary">({val})</span>
                          )}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </button>
            )
          })}
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
                  <p className="text-xs text-muted-foreground">{m.desc}</p>
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
          <span className="text-muted-foreground">Total mensal — {info.label}</span>
          <span className="font-bold text-base">{info.price}</span>
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
