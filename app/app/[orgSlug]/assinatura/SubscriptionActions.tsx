'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import CheckoutModal from '@/components/features/billing/CheckoutModal'
import { cancelSubscription, cancelSubscriptionWithRefund } from '@/actions/billing'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Zap } from 'lucide-react'

interface Props {
  orgSlug:            string
  currentPlan:        'starter' | 'pro' | 'business' | 'scale' | 'free' | 'trial' | 'free_trial' | null
  subscriptionStatus: string | null
  /** Prazo da garantia de reembolso de 14 dias (organizations.trial_ends_at
   *  reaproveitado após o primeiro pagamento — ver actions/billing.ts). Null
   *  = fora da janela ou nunca pagou; cancelamento normal, sem estorno. */
  refundEligibleUntil?: string | null
}

export default function SubscriptionActions({ orgSlug, currentPlan, subscriptionStatus, refundEligibleUntil }: Props) {
  const router = useRouter()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [canceling, setCanceling]       = useState(false)

  const withinRefundWindow = !!refundEligibleUntil && new Date(refundEligibleUntil).getTime() > Date.now()

  const isActive   = subscriptionStatus === 'active'
  const isCanceled = subscriptionStatus === 'canceled'
  const isTrial    = currentPlan === 'trial' || currentPlan === 'free_trial'

  // Default the modal to the "next" plan
  const suggestedPlan: 'starter' | 'pro' | 'business' =
    currentPlan === 'business' || currentPlan === 'scale' ? 'business'
    : currentPlan === 'pro'  ? 'business'
    : currentPlan === 'starter' ? 'pro'
    : 'starter'

  async function handleCancel() {
    setCanceling(true)
    if (withinRefundWindow) {
      const res = await cancelSubscriptionWithRefund(orgSlug)
      setCanceling(false)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      toast.success(res.refunded ? 'Assinatura cancelada e valor reembolsado.' : 'Assinatura cancelada.')
      router.refresh()
      return
    }
    const res = await cancelSubscription(orgSlug)
    setCanceling(false)
    if (!res.ok) {
      toast.error(res.error)
      return
    }
    toast.success('Assinatura cancelada.')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
      {/* Upgrade / subscribe button */}
      {!isCanceled && (
        <Button
          onClick={() => setCheckoutOpen(true)}
          variant={isTrial || !isActive ? 'default' : 'outline'}
          className="gap-2"
        >
          <Zap className="w-4 h-4" />
          {isTrial
            ? 'Assinar agora'
            : currentPlan === 'starter'
              ? 'Fazer upgrade para Pro'
              : currentPlan === 'pro'
                ? 'Fazer upgrade para Business'
                : isActive
                  ? 'Gerenciar plano'
                  : 'Assinar novamente'
          }
        </Button>
      )}

      {/* Cancel — only shown when there's an active paid subscription */}
      {isActive && !isTrial && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              {withinRefundWindow ? 'Cancelar e reembolsar' : 'Cancelar assinatura'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{withinRefundWindow ? 'Cancelar e receber reembolso?' : 'Cancelar assinatura?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {withinRefundWindow
                  ? 'Você está dentro da garantia de 14 dias — ao confirmar, a assinatura é cancelada e o valor pago é devolvido integralmente para a forma de pagamento usada.'
                  : 'Sua conta permanecerá ativa até o fim do período pago. Após isso, o acesso ao CRM será bloqueado e você poderá reativar quando quiser.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Manter assinatura</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={canceling}
                className="bg-destructive hover:bg-destructive/90"
              >
                {canceling
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> {withinRefundWindow ? 'Cancelando e reembolsando...' : 'Cancelando...'}</>
                  : withinRefundWindow ? 'Sim, cancelar e reembolsar' : 'Sim, cancelar'
                }
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      <CheckoutModal
        orgSlug={orgSlug}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        initialPlan={suggestedPlan}
      />
    </div>
  )
}
