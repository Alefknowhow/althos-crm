'use client'

/**
 * Modal shown when a user hits a plan-gated feature. Explains what the feature
 * is, which plan unlocks it, and links to the upgrade/subscription page.
 *
 * Pure presentation — open state is controlled by the caller (PlanGate or a
 * direct trigger). Real enforcement is server-side; this only nudges upgrades.
 */

import Link from 'next/link'
import { Sparkles } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  FEATURE_LABELS,
  PLAN_META,
  formatPlanPrice,
  minimumPlanFor,
  type FeatureKey,
} from '@/lib/plans/config'

interface UpgradeModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  feature: FeatureKey
  /** Where the "Ver planos" CTA links to. */
  upgradeHref: string
}

export function UpgradeModal({ open, onOpenChange, feature, upgradeHref }: UpgradeModalProps) {
  const requiredPlan = minimumPlanFor(feature)
  const planMeta = requiredPlan ? PLAN_META[requiredPlan] : null
  const label = FEATURE_LABELS[feature] ?? feature

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>Desbloqueie {label}</DialogTitle>
          <DialogDescription>
            {planMeta ? (
              <>
                O recurso <strong>{label}</strong> está disponível a partir do plano{' '}
                <strong>{planMeta.name}</strong>
                {planMeta.priceMonthlyCents > 0 && (
                  <> ({formatPlanPrice(planMeta.priceMonthlyCents)}/mês)</>
                )}
                . Faça upgrade para liberar este e outros recursos.
              </>
            ) : (
              <>O recurso <strong>{label}</strong> não está incluído no seu plano atual.</>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Agora não
          </Button>
          <Button asChild>
            <Link href={upgradeHref}>Ver planos</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
