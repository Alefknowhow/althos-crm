'use client'

import { useRouter, usePathname } from 'next/navigation'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'
import { MARKETING_SUB_ITEMS } from '@/lib/route-titles'

/**
 * Navegação de Anúncios — só o dropdown mobile (issue #24). No desktop, a
 * lista de seções mora na sidebar (SidebarMarketingAccordion, acordeão
 * "Anúncios") — mesmo padrão do SettingsTabsNav pra Configurações.
 */
const TABS = MARKETING_SUB_ITEMS.map(i => ({ key: i.seg || 'visao-geral', label: i.label, seg: i.seg }))

export default function MarketingTabsNav({ orgSlug }: { orgSlug: string }) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const base = `/app/${orgSlug}/marketing`

  const rest = pathname.startsWith(base) ? pathname.slice(base.length).replace(/^\//, '') : ''
  const activeSeg = rest.split('/')[0] // '' for Visão Geral

  const sections: MobileSection[] = TABS.map(t => ({ key: t.seg, label: t.label }))

  return (
    // md:hidden (não sm:hidden) — precisa casar com o breakpoint em que a
    // sidebar (hidden md:block) assume a navegação; entre sm e md nenhuma
    // das duas apareceria, achado do Codex review na PR #44.
    <div className="md:hidden pb-3">
      <MobileSectionPicker
        sections={sections}
        activeKey={activeSeg}
        onChange={seg => router.push(seg ? `${base}/${seg}` : base)}
      />
    </div>
  )
}
