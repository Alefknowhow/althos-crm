'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function DashboardTabsShell({
  stickyHeader,
  visaoGeral,
  pipeline,
  vendas,
  clientes,
  equipe,
  clinica,
  imoveis,
  defaultTab,
}: {
  /** Filtros/título da Inicial — renderizado junto com as abas dentro do
   *  mesmo container sticky, pra ambos ficarem fixos ao rolar a página. */
  stickyHeader?: ReactNode
  visaoGeral: ReactNode
  pipeline: ReactNode
  vendas: ReactNode
  clientes: ReactNode
  equipe: ReactNode
  /** Só passado quando a org é do nicho Clínicas — aba opcional. */
  clinica?: ReactNode
  /** Só passado quando a org é do nicho Imobiliária — aba opcional. */
  imoveis?: ReactNode
  /** Deep-link pra uma aba específica (ex.: ?tab=equipe) — opcional, cai
   *  pra "Visão Geral" quando ausente/inválido. Não muda nenhum
   *  comportamento existente pra quem não passa essa prop. */
  defaultTab?: string
}) {
  const extraTabs = (clinica ? 1 : 0) + (imoveis ? 1 : 0)
  const tabCount = 5 + extraTabs
  const gridColsClass = tabCount === 7 ? 'grid-cols-7' : tabCount === 6 ? 'grid-cols-6' : 'grid-cols-5'
  const validTabs = ['visao-geral', 'pipeline', 'vendas', 'clientes', 'equipe', ...(clinica ? ['clinica'] : []), ...(imoveis ? ['imoveis'] : [])]
  const initialTab = defaultTab && validTabs.includes(defaultTab) ? defaultTab : 'visao-geral'
  return (
    <Tabs defaultValue={initialTab} className="space-y-4">
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-2 -mt-2 pb-2 space-y-2 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/70">
        {stickyHeader}
        {/* Mobile: grid de N colunas iguais numa linha só (célula do grid dá
            a mesma largura pra todas, independente do tamanho do texto) —
            texto trunca com "…" se não couber. Desktop mantém o auto-width. */}
        <TabsList className={`grid gap-1 h-auto w-full sm:inline-flex sm:w-auto sm:gap-0 ${gridColsClass}`}>
          <TabsTrigger value="visao-geral" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Visão Geral</TabsTrigger>
          <TabsTrigger value="pipeline" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Pipeline</TabsTrigger>
          <TabsTrigger value="vendas" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Vendas</TabsTrigger>
          <TabsTrigger value="clientes" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Clientes</TabsTrigger>
          <TabsTrigger value="equipe" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Equipe</TabsTrigger>
          {clinica && <TabsTrigger value="clinica" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Clínica</TabsTrigger>}
          {imoveis && <TabsTrigger value="imoveis" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Imobiliária</TabsTrigger>}
        </TabsList>
      </div>
      <TabsContent value="visao-geral" className="space-y-4">
        {visaoGeral}
      </TabsContent>
      <TabsContent value="pipeline" className="space-y-4">
        {pipeline}
      </TabsContent>
      <TabsContent value="vendas" className="space-y-4">
        {vendas}
      </TabsContent>
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
    </Tabs>
  )
}
