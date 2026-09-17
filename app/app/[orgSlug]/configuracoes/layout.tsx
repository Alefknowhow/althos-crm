import SettingsTabsNav from './SettingsTabsNav'

/**
 * Layout de Configurações — sidebar vertical à esquerda (era uma barra de
 * abas horizontal fixa no topo). No mobile, a sidebar vira o
 * MobileSectionPicker (dropdown), montado dentro do próprio SettingsTabsNav.
 */
export default function ConfiguracoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="max-w-7xl mx-auto w-full min-w-0 flex flex-col sm:flex-row gap-6 min-h-0">
      <div className="shrink-0">
        <SettingsTabsNav orgSlug={params.orgSlug} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
