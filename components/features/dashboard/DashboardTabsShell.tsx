'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { MobileSectionPicker, type MobileSection } from '@/components/features/mobile/MobileSectionPicker'

export default function DashboardTabsShell({
  filtersSlot,
  visaoGeral,
  pipeline,
  vendas,
  clientes,
  equipe,
  clinica,
  imoveis,
  trafego,
  whatsapp,
  defaultTab,
  isClinic = false,
}: {
  /** Filtros (pipeline/vendedor/período) — renderizados ao lado do título da
   *  aba ativa, dentro do mesmo container sticky (issue #26: título só no
   *  conteúdo à esquerda, filtros à direita, sem saudação/data/breadcrumb). */
  filtersSlot?: ReactNode
  visaoGeral: ReactNode
  pipeline: ReactNode
  vendas: ReactNode
  clientes: ReactNode
  equipe: ReactNode
  /** Só passado quando a org é do nicho Clínicas — aba opcional. */
  clinica?: ReactNode
  /** Nicho Clínicas: "Vendas" some (o "atendimento concluído" já é a
   *  venda), "Clientes" vira "Pacientes", "Clínica" vira "Atendimentos" —
   *  as 5 abas ficam Visão Geral/Pipeline/Pacientes/Equipe/Atendimentos. */
  isClinic?: boolean
  /** Só passado quando a org é do nicho Imobiliária — aba opcional. */
  imoveis?: ReactNode
  /** Só passado quando a org é do nicho Agências de Tráfego — aba opcional. */
  trafego?: ReactNode
  /** Analytics de WhatsApp — aba sempre presente (não depende de nicho). */
  whatsapp?: ReactNode
  /** Deep-link pra uma aba específica (ex.: ?tab=equipe) — opcional, cai
   *  pra "Visão Geral" quando ausente/inválido. Não muda nenhum
   *  comportamento existente pra quem não passa essa prop. */
  defaultTab?: string
}) {
  const sections: MobileSection[] = [
    { key: 'visao-geral', label: 'Visão Geral' },
    { key: 'pipeline', label: 'Pipeline' },
    ...(!isClinic ? [{ key: 'vendas', label: 'Vendas' }] : []),
    { key: 'clientes', label: isClinic ? 'Pacientes' : 'Clientes' },
    { key: 'equipe', label: 'Equipe' },
    ...(clinica ? [{ key: 'clinica', label: isClinic ? 'Atendimentos' : 'Clínica' }] : []),
    ...(imoveis ? [{ key: 'imoveis', label: 'Imobiliária' }] : []),
    ...(trafego ? [{ key: 'trafego', label: 'Tráfego' }] : []),
    ...(whatsapp ? [{ key: 'whatsapp', label: 'WhatsApp' }] : []),
  ]
  const validTabs = sections.map(s => s.key)
  const initialTab = defaultTab && validTabs.includes(defaultTab) ? defaultTab : 'visao-geral'
  // Tabs vira controlado (era defaultValue não-controlado) pro seletor mobile
  // (MobileSectionPicker, G3) e o acordeão "Dashboards" da sidebar
  // (SidebarDashboardsAccordion, issue #26) conseguirem mudar a aba ativa.
  const [active, setActive] = useState(initialTab)

  // `useState(initialTab)` só roda no 1º mount — sem isto, clicar num
  // sub-item do acordeão da sidebar (nova URL com ?tab=X, mesma rota)
  // atualiza `defaultTab` mas o componente já montado ignoraria o valor
  // inicial de novo. Sincroniza sempre que a prop mudar.
  useEffect(() => {
    setActive(defaultTab && validTabs.includes(defaultTab) ? defaultTab : 'visao-geral')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTab])

  const activeLabel = sections.find(s => s.key === active)?.label ?? 'Visão Geral'

  return (
    <Tabs value={active} onValueChange={setActive} className="space-y-4">
      {/* <main> não tem mais pt-* (removido globalmente em
          app/[orgSlug]/layout.tsx), então esse painel já nasce colado — sem
          precisar de margin-top negativo, de -top-3 nem de pt-* próprio (ver
          .harness/agents/ux.md). */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pb-2 space-y-2 bg-background">
        {/* Título da aba ativa à esquerda, filtros à direita, uma linha só
            no desktop (issue #26) — sem saudação/data/breadcrumb repetido:
            o header global já mostra "Dashboards" (módulo), este título
            identifica a visão específica dentro dele. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h1 className="text-lg sm:text-xl font-semibold tracking-apple-tight text-foreground truncate">
            {activeLabel}
          </h1>
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-3 w-full sm:w-auto [&_[data-radix-select-trigger]]:shrink-0">
            {filtersSlot}
          </div>
        </div>
        {/* Abas horizontais removidas (issue #26) — a navegação entre visões
            do dashboard mora no acordeão "Dashboards" da sidebar
            (SidebarDashboardsAccordion), conforme #10. No mobile, sem
            sidebar sempre visível, mantém o seletor de seção inline. */}
        <div className="sm:hidden">
          <MobileSectionPicker sections={sections} activeKey={active} onChange={setActive} />
        </div>
      </div>
      <TabsContent value="visao-geral" className="space-y-4">
        {visaoGeral}
      </TabsContent>
      <TabsContent value="pipeline" className="space-y-4">
        {pipeline}
      </TabsContent>
      {!isClinic && (
        <TabsContent value="vendas" className="space-y-4">
          {vendas}
        </TabsContent>
      )}
      <TabsContent value="clientes" className="space-y-4">
        {clientes}
      </TabsContent>
      <TabsContent value="equipe" className="space-y-4">
        {equipe}
      </TabsContent>
      {clinica && (
        <TabsContent value="clinica" className="space-y-4">
          {clinica}
        </TabsContent>
      )}
      {imoveis && (
        <TabsContent value="imoveis" className="space-y-4">
          {imoveis}
        </TabsContent>
      )}
      {trafego && (
        <TabsContent value="trafego" className="space-y-4">
          {trafego}
        </TabsContent>
      )}
      {whatsapp && (
        <TabsContent value="whatsapp" className="space-y-4">
          {whatsapp}
        </TabsContent>
      )}
    </Tabs>
  )
}
