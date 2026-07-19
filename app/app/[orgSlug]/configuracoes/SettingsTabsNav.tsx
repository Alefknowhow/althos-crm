'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building, UsersRound, CreditCard, Share2, Bell, ShieldCheck, Bot } from 'lucide-react'

/**
 * Shared tab navigation for the settings hub. Each tab is its own route so the
 * existing server pages (Equipe, Assinatura, …) are reused as-is. Highlights the
 * active tab from the current pathname. Include it at the top of each settings
 * hub page (NOT on detail sub-pages like /whatsapp or /meta).
 */
const TABS = [
  { key: 'geral',        label: 'Geral',        icon: Building,    seg: '' },
  { key: 'agente-ia',    label: 'Agente IA',    icon: Bot,         seg: 'agente-ia' },
  { key: 'equipe',       label: 'Equipe',       icon: UsersRound,  seg: 'equipe' },
  { key: 'assinatura',   label: 'Assinatura',   icon: CreditCard,  seg: 'assinatura' },
  { key: 'notificacoes', label: 'Notificações', icon: Bell,        seg: 'notificacoes' },
  { key: 'seguranca',    label: 'Segurança',    icon: ShieldCheck, seg: 'seguranca' },
  { key: 'integracoes',  label: 'Integrações',  icon: Share2,      seg: 'integracoes' },
] as const

export default function SettingsTabsNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/configuracoes`

  // Derive active tab from the segment right after /configuracoes.
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0] // '' for Geral

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map(t => {
          const href = t.seg ? `${base}/${t.seg}` : base
          const active = activeSeg === t.seg
          const Icon = t.icon
          return (
            <Link
              key={t.key}
              href={href}
              className={cn(
                'flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
