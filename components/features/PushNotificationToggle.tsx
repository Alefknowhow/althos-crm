'use client'

/**
 * PushNotificationToggle
 *
 * One-click opt-in/opt-out for Web Push notifications, rendered as an icon
 * button. Lives in the org header (desktop only — md+; on mobile the same
 * action moves into HeaderMobileMenu to save header space).
 *
 * State machine lives in `usePushNotification` (lib/hooks/use-push-notification)
 * so the desktop icon button and the mobile menu item share one source of truth.
 */

import { Bell, BellOff, BellRing, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePushNotification } from '@/lib/hooks/use-push-notification'

export default function PushNotificationToggle({ orgSlug }: { orgSlug: string }) {
  const { state, enable, disable, supported } = usePushNotification(orgSlug)

  if (!supported || state === 'unsupported') return null

  if (state === 'denied') {
    return (
      <button
        type="button"
        disabled
        title="Notificações bloqueadas nas configurações do navegador"
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground/40 cursor-not-allowed"
      >
        <BellOff className="w-4 h-4" />
      </button>
    )
  }

  if (state === 'loading') {
    return (
      <button
        type="button"
        disabled
        className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
      </button>
    )
  }

  if (state === 'subscribed') {
    return (
      <button
        type="button"
        onClick={disable}
        title="Notificações push ativas — clique para desativar"
        className={cn(
          'w-8 h-8 inline-flex items-center justify-center rounded-md transition-colors',
          'text-primary hover:text-primary/70 hover:bg-muted',
        )}
      >
        <BellRing className="w-4 h-4" />
      </button>
    )
  }

  // unsubscribed
  return (
    <button
      type="button"
      onClick={enable}
      title="Ativar notificações push"
      className="w-8 h-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
    >
      <Bell className="w-4 h-4" />
    </button>
  )
}
