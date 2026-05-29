'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCheckoutSession } from '@/actions/billing'
import { toast } from 'sonner'
import { Loader2, FileText, QrCode, CreditCard, CheckCircle2, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

type Plan    = 'starter' | 'pro'
type Method  = 'BOLETO' | 'PIX' | 'CREDIT_CARD'

interface Props {
  orgSlug:     string
  open:        boolean
  onClose:     () => void
  initialPlan: Plan
}

const PLAN_INFO = {
  starter: { label: 'Starter', price: 'R$ 197/mês', color: 'text-foreground', icon: Users },
  pro:     { label: 'Pro',     price: 'R$ 397/mês', color: 'text-primary',    icon: Zap   },
}

const METHODS: { id: Method; label: string; desc: string; icon: React.ComponentType<any> }[] = [
  {
    id:    'PIX',
    label: 'PIX',
    desc:  'Aprovação instantânea. QR Code gerado no Asaas.',
    icon:  QrCode,
  },
  {
    id:    'BOLETO',
    label: 'Boleto Bancário',
    desc:  'Vencimento em 1 dia útil. Compensação em até 3 dias.',
    icon:  FileText,
  },
  {
    id:    'CREDIT_CARD',
    label: 'Cartão de Crédito',
    desc:  'Cobrança mensal automática no cartão.',
    icon:  CreditCard,
  },
]

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

    // Hard-redirect to Asaas payment page
    window.location.href = res.checkoutUrl
  }

  const info = PLAN_INFO[plan]

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Assinar plano</DialogTitle>
          <DialogDescription>
            Escolha o plano e a forma de pagamento.
          </DialogDescription>
        </DialogHeader>

        {/* Plan selector */}
        <div className="grid grid-cols-2 gap-3">
          {(['starter', 'pro'] as Plan[]).map(p => {
            const pi = PLAN_INFO[p]
            const Icon = pi.icon
            return (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={cn(
                  'rounded-xl border-2 p-3 text-left transition-all',
                  plan === p
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={cn('w-4 h-4', plan === p ? 'text-primary' : 'text-muted-foreground')} />
                  <span className="font-semibold text-sm">{pi.label}</span>
                </div>
                <span className="text-xs text-muted-foreground">{pi.price}</span>
                {plan === p && (
                  <CheckCircle2 className="w-3.5 h-3.5 text-primary mt-1.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* Payment method selector */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Forma de pagamento</p>
          {METHODS.map(m => {
            const Icon = m.icon
            return (
              <button
                key={m.id}
                onClick={() => setMethod(m.id)}
                className={cn(
                  'w-full rounded-lg border-2 p-3 flex items-start gap-3 text-left transition-all',
                  method === m.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', method === m.id ? 'text-primary' : 'text-muted-foreground')} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    {m.id === 'PIX' && (
                      <Badge variant="secondary" className="text-[10px] py-0">Recomendado</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{m.desc}</p>
                </div>
                {method === m.id && (
                  <CheckCircle2 className="w-4 h-4 text-primary ml-auto shrink-0 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* Summary + CTA */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total mensal</span>
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
