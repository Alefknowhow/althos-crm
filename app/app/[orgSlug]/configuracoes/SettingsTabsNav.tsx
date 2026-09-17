'use client'

import { useRouter, usePathname } from 'next/navigation'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'

/**
 * Navegação de Configurações — só o dropdown mobile. No desktop, a lista de
 * seções já mora na sidebar principal do app (SidebarConfigAccordion,
 * acordeão "Configurações") — mostrar a mesma lista aqui de novo era
 * redundante (a mesma navegação duplicada em dois lugares da tela).
 */
const TABS = [
  { key: 'geral',        label: 'Geral',        seg: '' },
  { key: 'agente-ia',    label: 'Agente IA',    seg: 'agente-ia' },
  { key: 'equipe',       label: 'Equipe',       seg: 'equipe' },
  { key: 'notificacoes', label: 'Notificações', seg: 'notificacoes' },
  { key: 'aparencia',    label: 'Aparência',    seg: 'aparencia' },
  { key: 'seguranca',    label: 'Segurança',    seg: 'seguranca' },
  { key: 'integracoes',  label: 'Integrações',  seg: 'integracoes' },
  { key: 'agentes',      label: 'Conector MCP', seg: 'agentes' },
] as const

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
