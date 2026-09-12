'use client'

import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Building, UsersRound, Share2, Bell, ShieldCheck, Bot, Palette, KeyRound } from 'lucide-react'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'

/**
 * Shared tab navigation for the settings hub. Each tab is its own route so the
 * existing server pages (Equipe, …) are reused as-is. Highlights the
 * active tab from the current pathname. Include it at the top of each settings
 * hub page (NOT on detail sub-pages like /whatsapp or /meta).
 *
 * "Assinatura" saiu daqui — virou janela independente (/app/[orgSlug]/assinatura,
 * fora de /configuracoes), acessível só pelo menu do usuário (Meu perfil),
 * visível apenas pro owner da org (ver HeaderUserMenu.tsx/SidebarUserMenu.tsx).
 */
const TABS = [
  { key: 'geral',        label: 'Geral',        icon: Building,    seg: '' },
  { key: 'agente-ia',    label: 'Agente IA',    icon: Bot,         seg: 'agente-ia' },
  { key: 'equipe',       label: 'Equipe',       icon: UsersRound,  seg: 'equipe' },
  { key: 'notificacoes', label: 'Notificações', icon: Bell,        seg: 'notificacoes' },
  { key: 'aparencia',    label: 'Aparência',    icon: Palette,     seg: 'aparencia' },
  { key: 'seguranca',    label: 'Segurança',    icon: ShieldCheck, seg: 'seguranca' },
  { key: 'integracoes',  label: 'Integrações',  icon: Share2,      seg: 'integracoes' },
  { key: 'agentes',      label: 'Conector MCP', icon: KeyRound,   seg: 'agentes' },
] as const

export default function SettingsTabsNav({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/configuracoes`

  // Derive active tab from the segment right after /configuracoes.
  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0] // '' for Geral

  const sections: MobileSection[] = TABS.map(t => ({ key: t.seg, label: t.label }))

  return (
    <div className="border-b border-border">
      <div className="sm:hidden py-1">
        <MobileSectionPicker
          sections={sections}
          activeKey={activeSeg}
          onChange={seg => router.push(seg ? `${base}/${seg}` : base)}
        />
      </div>
      <nav className="hidden sm:flex -mb-px flex-wrap gap-1">
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
