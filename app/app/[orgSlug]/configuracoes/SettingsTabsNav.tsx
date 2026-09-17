'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Building, UsersRound, Share2, Bell, ShieldCheck, Bot, Palette, KeyRound } from 'lucide-react'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'
import { VerticalTabsNav, type VerticalTabItem } from '@/components/ui/vertical-tabs'

/**
 * Navegação principal de Configurações — sidebar vertical à esquerda (era
 * uma barra horizontal de abas no topo). Cada item é sua própria rota, os
 * pages server-side existentes (Equipe, ...) continuam intactos. Destaca o
 * item ativo a partir do pathname atual.
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
  const items: VerticalTabItem[] = TABS.map(t => ({
    key: t.seg, label: t.label, icon: t.icon, href: t.seg ? `${base}/${t.seg}` : base,
  }))

  return (
    <>
      <div className="sm:hidden pb-3">
        <MobileSectionPicker
          sections={sections}
          activeKey={activeSeg}
          onChange={seg => router.push(seg ? `${base}/${seg}` : base)}
        />
      </div>
      <div className="hidden sm:block">
        <VerticalTabsNav items={items} activeKey={activeSeg} />
      </div>
    </>
  )
}
