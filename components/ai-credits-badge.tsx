'use client'

/**
 * Compact badge showing the account's remaining AI credits for the current
 * month. Intended for headers/toolbars near AI-powered features.
 *
 * Reads from useSubscription (per-account, RLS-scoped). Clicking opens the
 * credits panel (foco em comprar créditos avulsos) — o upgrade de plano
 * continua acessível de lá como ação secundária, não é mais o destino direto.
 */

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'
import { cn } from '@/lib/utils'
import dynamic from 'next/dynamic'

const CheckoutModal = dynamic(() => import('@/components/features/billing/CheckoutModal'), { ssr: false })
const AiCreditsPanel = dynamic(() => import('@/components/features/billing/AiCreditsPanel'), { ssr: false })

interface AiCreditsBadgeProps {
  className?: string
  /** Hide entirely on the Free plan (no credits). Default false. */
  hideWhenZeroIncluded?: boolean
}

/** Map the current plan to the most sensible upgrade target for checkout. */
function nextPlan(planId: string): 'starter' | 'pro' | 'business' {
  if (planId === 'pro' || planId === 'business') return 'business'
  if (planId === 'starter') return 'pro'
  return 'starter'
}

export function AiCreditsBadge({ className, hideWhenZeroIncluded = false }: AiCreditsBadgeProps) {
  const { loading, credits, planId } = useSubscription()
  const pathname = usePathname() || ''
  const match = pathname.match(/^\/app\/([^/]+)/)
  const orgSlug = match?.[1] ?? ''
  const [creditsOpen, setCreditsOpen] = useState(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)

  if (loading) return null
  if (hideWhenZeroIncluded && credits.included === 0 && credits.purchased === 0) return null

  const total = credits.included + credits.purchased
  const low = total > 0 && credits.available / total <= 0.1
  const empty = credits.available <= 0

  return (
    <>
      <button
        type="button"
        onClick={() => orgSlug && setCreditsOpen(true)}
        title={`${credits.available} de ${total} créditos de IA restantes neste mês`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
          empty
            ? 'border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15'
            : low
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 hover:bg-amber-500/15 dark:text-amber-400'
              : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/15',
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>
          {credits.available}
          <span className="opacity-60"> créditos</span>
        </span>
        {planId === 'free' && <span className="opacity-60">· Free</span>}
      </button>

      {orgSlug && creditsOpen && (
        <AiCreditsPanel
          open={creditsOpen}
          onClose={() => setCreditsOpen(false)}
          available={credits.available}
          total={total}
          onUpgradeClick={() => { setCreditsOpen(false); setUpgradeOpen(true) }}
        />
      )}

      {orgSlug && upgradeOpen && (
        <CheckoutModal
          orgSlug={orgSlug}
          open={upgradeOpen}
          onClose={() => setUpgradeOpen(false)}
          initialPlan={nextPlan(planId)}
        />
      )}
    </>
  )
}
