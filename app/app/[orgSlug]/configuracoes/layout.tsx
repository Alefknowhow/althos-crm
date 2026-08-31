import SettingsTabsNav from './SettingsTabsNav'

/**
 * Header + abas fixas de Configurações — antes duplicados em cada page.tsx
 * (remontava a cada navegação, e cada sub-página tinha sua própria margem
 * max-w-*, então a largura pulava ao trocar de aba). Agora é um único layout
 * compartilhado: as abas não remontam e a margem (max-w-7xl mx-auto — mais
 * larga que o padrão pra caber as 9 abas numa linha só) é a mesma em toda
 * página de Configurações.
 */
export default function ConfiguracoesLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { orgSlug: string }
}) {
  return (
    <div className="max-w-7xl mx-auto w-full min-w-0">
      {/* Cabeçalho + abas fixos — não rolam junto com o conteúdo da
          sub-página abaixo. -mx/px compensam o padding lateral do <main> pai
          pra o fundo cobrir até a borda enquanto fica "colado" no topo.
          Fundo sólido (não translúcido) — sem efeito de fade no conteúdo
          por trás ao rolar. <main> não tem mais pt-* (removido globalmente
          em app/[orgSlug]/layout.tsx), então esse painel já nasce colado —
          sem precisar de margin-top negativo nem de pt-* próprio (ver
          .harness/agents/ux.md). */}
      <div id="configuracoes-sticky-header" className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pb-3 bg-background">
        <SettingsTabsNav orgSlug={params.orgSlug} />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  )
}
