'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Phone, PhoneCall, MessageSquareText, Bot, Users2, BarChart3, Hash, Wallet, Sliders,
} from 'lucide-react'

/** Mesmo padrão de app/app/[orgSlug]/configuracoes/SettingsTabsNav.tsx —
 *  a sidebar tem só 1 item "Voice"; as sub-seções viram abas de rota aqui. */
const TABS = [
  { key: 'geral',         label: 'Visão geral', icon: Phone,            seg: '' },
  { key: 'chamadas',      label: 'Chamadas',    icon: PhoneCall,        seg: 'chamadas' },
  { key: 'sms',           label: 'SMS',         icon: MessageSquareText, seg: 'sms' },
  { key: 'agentes',       label: 'Agentes de IA', icon: Bot,            seg: 'agentes' },
  { key: 'equipe',        label: 'Equipe',      icon: Users2,           seg: 'equipe' },
  { key: 'analytics',     label: 'Analytics',   icon: BarChart3,        seg: 'analytics' },
  { key: 'numeros',       label: 'Números',     icon: Hash,             seg: 'numeros' },
  { key: 'creditos',      label: 'Créditos',    icon: Wallet,           seg: 'creditos' },
  { key: 'configuracoes', label: 'Configurações', icon: Sliders,        seg: 'configuracoes' },
] as const

export default function VoiceTabsNav({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/voice`

  // Sub-rota /voice/chamadas/[id] deve manter a aba "Chamadas" ativa —
  // olhamos só o primeiro segmento depois de /voice.
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0]

  return (
    <div className="border-b border-border">
      <nav className="-mb-px flex flex-wrap gap-1 overflow-x-auto hide-scrollbar">
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
