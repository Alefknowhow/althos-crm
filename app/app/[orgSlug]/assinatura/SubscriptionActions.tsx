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
import { cancelSubscription } from '@/actions/billing'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { Loader2, Zap } from 'lucide-react'

interface Props {
  orgSlug:            string
  currentPlan:        'starter' | 'pro' | 'business' | 'scale' | 'free' | 'trial' | 'free_trial' | null
  subscriptionStatus: string | null
}

export default function SubscriptionActions({ orgSlug, currentPlan, subscriptionStatus }: Props) {
  const router = useRouter()
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [canceling, setCanceling]       = useState(false)

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
              Cancelar assinatura
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar assinatura?</AlertDialogTitle>
              <AlertDialogDescription>
                Sua conta permanecerá ativa até o fim do período pago. Após isso,
                o acesso ao CRM será bloqueado e você poderá reativar quando quiser.
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
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Cancelando...</>
                  : 'Sim, cancelar'
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
