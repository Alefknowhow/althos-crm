'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Zap } from 'lucide-react'

const IgIcon = () => (
  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
  </svg>
)

/**
 * Abas compartilhadas do hub de Automações: alterna entre as automações do
 * CRM (/automacoes) e as sociais do Instagram (/social). Colocada no topo das
 * duas áreas para que funcionem como uma tela unificada.
 */
export default function AutomationsTabsNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}`
  const onSocial = pathname.includes('/social')

  const tabs = [
    { label: 'CRM', href: `${base}/automacoes`, icon: <Zap className="w-4 h-4" />, active: !onSocial },
    { label: 'Instagram · DMs', href: `${base}/social`, icon: <IgIcon />, active: onSocial },
  ]

  return (
    <nav className="flex gap-1" aria-label="Tipos de automação">
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
