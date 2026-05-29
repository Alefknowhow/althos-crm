'use server'

import Link from 'next/link'
import { AlertTriangle, Zap } from 'lucide-react'
import { getTrialDaysRemaining } from '@/lib/billing/limits'

interface Props {
  orgId:   string
  orgSlug: string
  plan:    string | null
}

/**
 * Sticky banner shown inside the app when the org is on a trial.
 * Disappears once they're on a paid plan or trial_ends_at is null
 * (grandfathered / billing_managed_externally accounts).
 */
export default async function TrialBanner({ orgId, orgSlug, plan }: Props) {
  // Only show for trial plans
  if (plan !== 'trial' && plan !== 'free_trial') return null

  const days = await getTrialDaysRemaining(orgId)
  if (days === null) return null   // no expiry set — grandfathered, don't show

  const isExpired = days === 0
  const isUrgent  = days <= 3

  return (
    <div
      className={`w-full px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium
        ${isExpired
          ? 'bg-destructive text-destructive-foreground'
          : isUrgent
            ? 'bg-amber-500 text-white'
            : 'bg-primary/10 text-primary border-b border-primary/20'
        }`}
    >
      {(isExpired || isUrgent) && (
        <AlertTriangle className="w-4 h-4 shrink-0" />
      )}

      <span>
        {isExpired
          ? 'Seu período de trial expirou.'
          : days === 1
            ? 'Último dia do seu trial!'
            : `${days} dias restantes no trial gratuito.`
        }
      </span>

      <Link
        href={`/app/${orgSlug}/upgrade`}
        className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-semibold transition-colors
          ${isExpired || isUrgent
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
      >
        <Zap className="w-3 h-3" />
        Fazer upgrade
      </Link>
    </div>
  )
}
