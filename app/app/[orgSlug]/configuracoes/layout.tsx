import SettingsTabsNav from './SettingsTabsNav'

/**
 * Layout de Configurações — a navegação entre seções mora na sidebar
 * principal do app (SidebarConfigAccordion), não numa coluna própria aqui.
 * No mobile (onde a sidebar principal não fica sempre visível),
 * SettingsTabsNav mostra o dropdown de seções.
 */
export default function ConfiguracoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="max-w-5xl mx-auto w-full min-w-0">
      <SettingsTabsNav orgSlug={params.orgSlug} />
      {children}
    </div>
  )
}
