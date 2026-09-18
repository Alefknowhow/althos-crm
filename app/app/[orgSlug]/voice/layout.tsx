import VoiceTabsNav from './VoiceTabsNav'

/** Navegação entre sub-seções mora no acordeão "Voice" da sidebar principal
 *  (components/features/SidebarVoiceAccordion.tsx) — sem abas horizontais
 *  aqui, mesmo padrão de app/app/[orgSlug]/configuracoes/layout.tsx. No
 *  mobile (onde a sidebar principal não fica sempre visível), VoiceTabsNav
 *  mostra o dropdown de seções. */
export default function VoiceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="w-full min-w-0">
      <VoiceTabsNav orgSlug={params.orgSlug} />
      {children}
    </div>
  )
}
