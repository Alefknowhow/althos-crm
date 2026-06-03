'use client'

/**
 * Compact badge showing the account's remaining AI credits for the current
 * month. Intended for headers/toolbars near AI-powered features.
 *
 * Reads from useSubscription (per-account, RLS-scoped). Click navigates to the
 * upgrade/subscription page so users low on credits can top up.
 */

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { useSubscription } from '@/hooks/use-subscription'
import { cn } from '@/lib/utils'

interface AiCreditsBadgeProps {
  className?: string
  /** Hide entirely on the Free plan (no credits). Default false. */
  hideWhenZeroIncluded?: boolean
}

export function AiCreditsBadge({ className, hideWhenZeroIncluded = false }: AiCreditsBadgeProps) {
  const { loading, credits, planId } = useSubscription()
  const pathname = usePathname() || ''
  const match = pathname.match(/^\/app\/([^/]+)/)
  const href = match ? `/app/${match[1]}/upgrade` : '/pricing'

  if (loading) return null
  if (hideWhenZeroIncluded && credits.included === 0 && credits.purchased === 0) return null

  const total = credits.included + credits.purchased
  const low = total > 0 && credits.available / total <= 0.1
  const empty = credits.available <= 0

  return (
    <Link
      href={href}
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
    </Link>
  )
}
