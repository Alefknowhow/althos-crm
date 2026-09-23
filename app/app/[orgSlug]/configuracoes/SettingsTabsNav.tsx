'use client'

import { useRouter, usePathname } from 'next/navigation'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'
import { CONFIG_SUB_ITEMS } from '@/lib/route-titles'

/**
 * Navegação de Configurações — só o dropdown mobile. No desktop, a lista de
 * seções já mora na sidebar principal do app (SidebarConfigAccordion,
 * acordeão "Configurações") — mostrar a mesma lista aqui de novo era
 * redundante (a mesma navegação duplicada em dois lugares da tela).
 */
const TABS = CONFIG_SUB_ITEMS.map(i => ({ key: i.seg || 'geral', label: i.label, seg: i.seg }))

export default function SettingsTabsNav({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/configuracoes`

  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0] // '' for Geral

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
