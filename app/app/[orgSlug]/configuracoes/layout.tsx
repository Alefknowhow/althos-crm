import SettingsTabsNav from './SettingsTabsNav'

/**
 * Header + abas fixas de Configurações — antes duplicados em cada page.tsx
 * (remontava a cada navegação, e cada sub-página tinha sua própria margem
 * max-w-*, então a largura pulava ao trocar de aba). Agora é um único layout
 * compartilhado: as abas não remontam e a margem (max-w-5xl mx-auto) é a
 * mesma em toda página de Configurações.
 */
export default function ConfiguracoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="space-y-6 max-w-5xl mx-auto w-full min-w-0">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      {children}
    </div>
  )
}
