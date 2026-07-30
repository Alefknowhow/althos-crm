'use client'

/**
 * HeaderMobileMenu
 *
 * Mobile is a support view, not the primary way to use the CRM — so its
 * header keeps only what's checked constantly (sidebar toggle, module name,
 * notification bell) and folds everything else (theme, push opt-in, Central
 * de Ajuda, Suporte) into this single "mais" menu. Desktop keeps the
 * individual buttons (room isn't scarce there); this component only renders
 * below `md`.
 */

import { useTheme } from 'next-themes'
import Link from 'next/link'
import {
  MoreVertical, Sun, Moon, Monitor, Bell, BellOff, BellRing, Loader2,
  HelpCircle, MessageCircle,
} from 'lucide-react'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { usePushNotification } from '@/lib/hooks/use-push-notification'

export function HeaderMobileMenu({ orgSlug }: { orgSlug: string }) {
  const { setTheme } = useTheme()
  const { state: pushState, enable, disable, supported: pushSupported } = usePushNotification(orgSlug)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Mais opções"
          className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <MoreVertical className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Tema</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => setTheme('light')} className="cursor-pointer">
          <Sun className="mr-2 h-4 w-4" /> Claro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')} className="cursor-pointer">
          <Moon className="mr-2 h-4 w-4" /> Escuro
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')} className="cursor-pointer">
          <Monitor className="mr-2 h-4 w-4" /> Sistema
        </DropdownMenuItem>

        {pushSupported && pushState !== 'denied' && (
          <>
            <DropdownMenuSeparator />
            {pushState === 'subscribed' ? (
              <DropdownMenuItem onClick={disable} className="cursor-pointer">
                <BellRing className="mr-2 h-4 w-4 text-primary" /> Desativar notificações
              </DropdownMenuItem>
            ) : pushState === 'loading' ? (
              <DropdownMenuItem disabled className="cursor-pointer">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde…
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={enable} className="cursor-pointer">
                <Bell className="mr-2 h-4 w-4" /> Ativar notificações
              </DropdownMenuItem>
            )}
          </>
        )}
        {pushState === 'denied' && (
          <DropdownMenuItem disabled className="cursor-pointer">
            <BellOff className="mr-2 h-4 w-4" /> Notificações bloqueadas
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href={`/app/${orgSlug}/ajuda`}>
            <HelpCircle className="mr-2 h-4 w-4" /> Central de Ajuda
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => window.dispatchEvent(new CustomEvent('althos:support-open'))}
          className="cursor-pointer"
        >
          <MessageCircle className="mr-2 h-4 w-4" /> Falar com suporte
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
