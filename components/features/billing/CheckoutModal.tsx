'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCheckoutSession } from '@/actions/billing'
import { toast } from 'sonner'
import { Loader2, FileText, QrCode, CreditCard, CheckCircle2, XCircle, Zap, Users, Rocket } from 'lucide-react'
import { cn } from '@/lib/utils'

type Plan    = 'starter' | 'pro' | 'scale'
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
  scale:   boolean | string
}[] = [
  { label: 'Leads e clientes',                  starter: 'Ilimitados',   pro: 'Ilimitados',   scale: 'Ilimitados'   },
  { label: 'Oportunidades e pipeline',           starter: true,           pro: true,           scale: true           },
  { label: 'Formulários de captação',            starter: true,           pro: true,           scale: true           },
  { label: 'WhatsApp centralizado',              starter: true,           pro: true,           scale: true           },
  { label: 'Registro e histórico de vendas',     starter: true,           pro: true,           scale: true           },
  { label: 'Tarefas e atividades',               starter: true,           pro: true,           scale: true           },
  { label: 'Agendamentos online',                starter: true,           pro: true,           scale: true           },
  { label: 'Atendimento com IA 24/7',            starter: false,          pro: true,           scale: true           },
  { label: 'Score e qualificação por IA',        starter: false,          pro: true,           scale: true           },
  { label: 'Insights de vendas com IA',          starter: false,          pro: true,           scale: true           },
  { label: 'Follow-up automático',               starter: false,          pro: true,           scale: true           },
  { label: 'Instagram (DMs e comentários)',      starter: false,          pro: true,           scale: true           },
  { label: 'Meta Ads + Google Ads',              starter: false,          pro: true,           scale: true           },
  { label: 'Pixel e CAPI',                       starter: false,          pro: true,           scale: true           },
  { label: 'E-mail marketing',                   starter: false,          pro: true,           scale: true           },
  { label: 'IA avançada e previsões',            starter: false,          pro: false,          scale: true           },
  { label: 'Painéis personalizados',             starter: false,          pro: false,          scale: true           },
  { label: 'API aberta e webhooks',              starter: false,          pro: false,          scale: true           },
  { label: 'Usuários incluídos',                 starter: '1 usuário',    pro: 'Até 5',        scale: 'Ilimitado'    },
  { label: 'Gerente de conta dedicado',          starter: false,          pro: false,          scale: true           },
]

const PLAN_INFO: Record<Plan, {
  label:    string
  tagline:  string
  price:    string
  priceFmt: string
  icon:     React.ComponentType<{ className?: string }>
  popular?: boolean
}> = {
  starter: {
    label:    'Starter',
    tagline:  'Ideal para começar',
    price:    'R$ 197/mês',
    priceFmt: 'R$ 197',
    icon:     Users,
  },
  pro: {
    label:    'Pro',
    tagline:  'Para crescer',
    price:    'R$ 397/mês',
    priceFmt: 'R$ 397',
    icon:     Zap,
    popular:  true,
  },
  scale: {
    label:    'Scale',
    tagline:  'Para escalar sem limites',
    price:    'R$ 697/mês',
    priceFmt: 'R$ 697',
    icon:     Rocket,
  },
}

const METHODS: { id: Method; label: string; desc: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'PIX',         label: 'PIX',              desc: 'Aprovação instantânea.',       icon: QrCode     },
  { id: 'BOLETO',      label: 'Boleto Bancário',   desc: 'Vencimento em 1 dia útil.',   icon: FileText   },
  { id: 'CREDIT_CARD', label: 'Cartão de Crédito', desc: 'Cobrança mensal automática.', icon: CreditCard },
]

const ALL_PLANS: Plan[] = ['starter', 'pro', 'scale']

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
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assinar plano</DialogTitle>
          <DialogDescription>
            Escolha o plano e a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        {/* ── Plan selector ── */}
        <div className="grid grid-cols-3 gap-2.5">
          {ALL_PLANS.map(p => {
            const pi     = PLAN_INFO[p]
            const Icon   = pi.icon
            const active = plan === p

            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  'relative rounded-xl border-2 p-4 text-left transition-all flex flex-col gap-2.5',
                  active
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                {pi.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-primary text-primary-foreground px-3 py-0.5 text-[10px] font-semibold whitespace-nowrap">
                    Mais popular
                  </span>
                )}

                <div className="flex items-start justify-between gap-1 mt-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('w-4 h-4', active ? 'text-primary' : 'text-muted-foreground')} />
                    <span className="font-semibold text-sm">{pi.label}</span>
                  </div>
                  {active && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                </div>

                <div className="flex items-end gap-1">
                  <span className={cn('text-xl font-bold tabular-nums', active ? 'text-foreground' : 'text-muted-foreground')}>
                    {pi.priceFmt}
                  </span>
                  <span className="text-xs text-muted-foreground mb-0.5">/mês</span>
                </div>

                <p className="text-xs text-muted-foreground leading-snug">{pi.tagline}</p>
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
            <span className="text-center" style={{ color: '#7C3AED' }}>Scale</span>
          </div>
          {PLAN_FEATURES.map((feat, i) => (
            <div
              key={feat.label}
              className={cn('grid grid-cols-4 items-center px-4 py-2 text-xs border-t', i % 2 !== 0 && 'bg-muted/20')}
            >
              <span className="font-medium text-foreground/80 col-span-1">{feat.label}</span>
              {(['starter', 'pro', 'scale'] as Plan[]).map(p => {
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
