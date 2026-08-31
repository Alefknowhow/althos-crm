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
          sub-página abaixo. -mx/px compensam o padding do <main> pai pra
          o fundo cobrir até a borda enquanto fica "colado" no topo. Fundo
          sólido (não translúcido) — sem efeito de fade no conteúdo por trás
          ao rolar. Pra ficar 100% colado na header global (sem margem
          visível): cancela o pt-3 do <main> via marginTop inline E não tem
          nenhum pt-* próprio — os dois juntos são necessários, um só não
          resolve (ver .harness/agents/ux.md). */}
      <div id="configuracoes-sticky-header" className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pb-3 bg-background" style={{ marginTop: '-0.75rem' }}>
        <SettingsTabsNav orgSlug={params.orgSlug} />
      </div>

      <div className="pt-6">{children}</div>
    </div>
  )
}
