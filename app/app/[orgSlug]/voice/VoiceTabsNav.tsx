'use client'

import { useRouter, usePathname } from 'next/navigation'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'

/**
 * Navegação de Voice — só o dropdown mobile. No desktop, a lista de seções
 * já mora na sidebar principal do app (SidebarVoiceAccordion, acordeão
 * "Voice") — mostrar a mesma lista aqui de novo era redundante (a mesma
 * navegação duplicada em dois lugares da tela, além de ocupar uma barra de
 * abas horizontal inteira). Mesmo padrão de
 * configuracoes/SettingsTabsNav.tsx.
 */
const TABS = [
  { key: 'geral',      label: 'Visão geral',        seg: '' },
  { key: 'interacoes', label: 'Chamadas & SMS',     seg: 'interacoes' },
  { key: 'agentes',    label: 'Agentes de IA',      seg: 'agentes' },
  { key: 'analytics',  label: 'Analytics & Equipe', seg: 'analytics' },
  { key: 'conta',      label: 'Conta',              seg: 'conta' },
] as const

export default function VoiceTabsNav({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/voice`

  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0]

  const sections: MobileSection[] = TABS.map(t => ({ key: t.seg, label: t.label }))

  return (
    <div className="sm:hidden pb-3">
      <MobileSectionPicker
        sections={sections}
        activeKey={activeSeg}
        onChange={seg => router.push(seg ? `${base}/${seg}` : base)}
      />
    </div>
  )
}
