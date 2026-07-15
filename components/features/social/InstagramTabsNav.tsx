'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { MessageCircle, Zap } from 'lucide-react'

/**
 * Abas internas do hub do Instagram: DM (inbox manual) ↔ Automações (regras +
 * funis + conexão). O hub em si vive na sidebar como "Instagram", separado
 * de "Automações" (que agora é só CRM).
 */
export default function InstagramTabsNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}`
  const onInbox = pathname.includes('/social/inbox')

  const tabs = [
    { label: 'DM', href: `${base}/social/inbox`, icon: <MessageCircle className="w-4 h-4" />, active: onInbox },
    { label: 'Automações', href: `${base}/social`, icon: <Zap className="w-4 h-4" />, active: !onInbox },
  ]

  return (
    <nav className="flex gap-1" aria-label="Áreas do Instagram">
      {tabs.map(t => (
        <Link
          key={t.href}
          href={t.href}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap',
            t.active
              ? 'bg-primary text-primary-foreground font-medium'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          {t.icon} {t.label}
        </Link>
      ))}
    </nav>
  )
}
