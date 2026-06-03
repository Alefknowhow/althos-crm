'use client'

/**
 * Wraps UI that should only be available on certain plans.
 *
 * Behaviour:
 *  - While the subscription loads, renders nothing (or `fallback`).
 *  - If the account's plan includes `feature`, renders `children`.
 *  - Otherwise renders a locked state. With `mode="overlay"` it shows the
 *    children dimmed with a lock + click-to-upgrade; with `mode="hide"` it
 *    renders `fallback` (default null); with `mode="replace"` it renders the
 *    `locked` node.
 *
 * SECURITY: this is presentation only. Always enforce the same gate
 * server-side (lib/plans/server.ts → checkFeatureAccess) before performing the
 * gated operation.
 */

import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'
import { UpgradeModal } from '@/components/upgrade-modal'
import { FEATURE_LABELS, type FeatureKey } from '@/lib/plans/config'

interface PlanGateProps {
  feature: FeatureKey
  children: ReactNode
  /** How to present the locked state. Default 'overlay'. */
  mode?: 'overlay' | 'hide' | 'replace'
  /** Shown while loading or when mode='hide'. */
  fallback?: ReactNode
  /** Custom locked node when mode='replace'. */
  locked?: ReactNode
}

/** Derive `/app/{slug}/upgrade` from the current pathname. */
function useUpgradeHref(): string {
  const pathname = usePathname() || ''
  const match = pathname.match(/^\/app\/([^/]+)/)
  return match ? `/app/${match[1]}/upgrade` : '/pricing'
}

export function PlanGate({ feature, children, mode = 'overlay', fallback = null, locked }: PlanGateProps) {
  const { loading, hasFeature } = useSubscription()
  const [modalOpen, setModalOpen] = useState(false)
  const upgradeHref = useUpgradeHref()

  if (loading) return <>{fallback}</>
  if (hasFeature(feature)) return <>{children}</>

  // ── Locked ──
  if (mode === 'hide') return <>{fallback}</>
  if (mode === 'replace') return <>{locked ?? fallback}</>

  // overlay
  return (
    <>
      <div className="relative">
        <div className="pointer-events-none select-none opacity-40 blur-[1px]">{children}</div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-lg bg-background/30 text-sm font-medium text-foreground backdrop-blur-[2px] transition-colors hover:bg-background/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-4 w-4" />
          </span>
          <span>Desbloquear {FEATURE_LABELS[feature] ?? feature}</span>
        </button>
      </div>
      <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} feature={feature} upgradeHref={upgradeHref} />
    </>
  )
}

/**
 * Headless variant: exposes whether the feature is available and a helper to
 * open the upgrade modal. Useful for gating an action handler rather than a
 * region of UI.
 */
export function usePlanGate(feature: FeatureKey) {
  const { loading, hasFeature } = useSubscription()
  const [modalOpen, setModalOpen] = useState(false)
  const upgradeHref = useUpgradeHref()

  const allowed = !loading && hasFeature(feature)

  const modal = (
    <UpgradeModal open={modalOpen} onOpenChange={setModalOpen} feature={feature} upgradeHref={upgradeHref} />
  )

  return {
    loading,
    allowed,
    /** Returns true if allowed; otherwise opens the upgrade modal and returns false. */
    guard: () => {
      if (allowed) return true
      setModalOpen(true)
      return false
    },
    modal,
  }
}
