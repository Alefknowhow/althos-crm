'use client'

/**
 * Dashboard nudge inviting Free-plan accounts to upgrade. Driven by the new
 * per-account subscription system (useSubscription).
 *
 * Visibility rules:
 *   - Hidden while loading (no flash).
 *   - Hidden for super-admins (the hook reports them as Business).
 *   - Shown ONLY on the Free plan — paid plans don't need the nudge.
 *   - Dismissible per org (localStorage). Re-appears next month is fine.
 *
 * Enforcement of plan limits is server-side; this is purely promotional.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, ArrowRight, X } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'

export default function UpgradeBanner({ orgSlug }: { orgSlug: string }) {
  const { loading, planId, isSuperAdmin } = useSubscription()
  const storageKey = `althos.upgradebanner.dismissed.${orgSlug}`
  const [dismissed, setDismissed] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(storageKey) === '1')
    } catch {
      setDismissed(false)
    }
  }, [storageKey])

  function dismiss() {
    try {
      window.localStorage.setItem(storageKey, '1')
    } catch {
      /* privacy mode — ignore */
    }
    setDismissed(true)
  }

  if (loading || dismissed === null || dismissed) return null
  if (isSuperAdmin) return null
  if (planId !== 'free') return null

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-5 py-4">
      <div className="flex items-center gap-4 pr-8">
        <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary sm:flex">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">
            Desbloqueie IA, automações e mais com um plano pago
          </p>
          <p className="text-xs text-muted-foreground">
            Você está no plano Free. Faça upgrade para liberar qualificação de leads por IA,
            atendente 24/7, insights e créditos mensais.
          </p>
        </div>
        <Link
          href={`/app/${orgSlug}/upgrade`}
          className="hidden shrink-0 items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
        >
          Ver planos
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <button
        type="button"
        onClick={dismiss}
        aria-label="Dispensar"
        className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
