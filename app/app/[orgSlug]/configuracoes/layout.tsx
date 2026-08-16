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
    <div className="max-w-5xl mx-auto w-full min-w-0">
      {/* Cabeçalho + abas fixos — não rolam junto com o conteúdo da
          sub-página abaixo. -mx/px compensam o padding do <main> pai pra
          o fundo cobrir até a borda enquanto fica "colado" no topo. Fundo
          sólido (não translúcido) — sem efeito de fade no conteúdo por trás
          ao rolar. */}
      <div id="configuracoes-sticky-header" className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-3 pb-4 bg-background space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
        </div>

        <SettingsTabsNav orgSlug={params.orgSlug} />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  )
}
