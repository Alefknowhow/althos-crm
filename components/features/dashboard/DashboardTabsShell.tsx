'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function DashboardTabsShell({
  stickyHeader,
  visaoGeral,
  comercial,
  vendasClientes,
  equipeAtendimento,
}: {
  /** Filtros/título da Inicial — renderizado junto com as abas dentro do
   *  mesmo container sticky, pra ambos ficarem fixos ao rolar a página. */
  stickyHeader?: ReactNode
  visaoGeral: ReactNode
  comercial: ReactNode
  vendasClientes: ReactNode
  equipeAtendimento: ReactNode
}) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-2 -mt-2 pb-2 space-y-2 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/70">
        {stickyHeader}
        {/* Mobile: grid de 4 colunas iguais numa linha só (célula do grid dá
            a mesma largura pra todas, independente do tamanho do texto) —
            texto trunca com "…" se não couber. Desktop mantém o auto-width. */}
        <TabsList className="grid grid-cols-4 gap-1 h-auto w-full sm:inline-flex sm:w-auto sm:gap-0">
          <TabsTrigger value="visao-geral" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Visão Geral</TabsTrigger>
          <TabsTrigger value="comercial" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Comercial</TabsTrigger>
          <TabsTrigger value="vendas-clientes" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Vendas e Clientes</TabsTrigger>
          <TabsTrigger value="equipe-atendimento" className="px-1.5 py-1.5 text-[11px] sm:text-sm sm:px-3 sm:py-1 truncate">Equipe</TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="visao-geral" className="space-y-4">
        {visaoGeral}
      </TabsContent>
      <TabsContent value="comercial" className="space-y-4">
        {comercial}
      </TabsContent>
      <TabsContent value="vendas-clientes" className="space-y-4">
        {vendasClientes}
      </TabsContent>
      <TabsContent value="equipe-atendimento" className="space-y-4">
        {equipeAtendimento}
      </TabsContent>
    </Tabs>
  )
}
