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
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 px-3 sm:px-5 pt-5 -mt-5 pb-3 space-y-4 bg-secondary/40 backdrop-blur supports-[backdrop-filter]:bg-secondary/70">
        {stickyHeader}
        <TabsList className="flex-wrap h-auto w-full sm:w-auto">
          <TabsTrigger value="visao-geral" className="flex-1 sm:flex-none">Visão Geral</TabsTrigger>
          <TabsTrigger value="comercial" className="flex-1 sm:flex-none">Comercial</TabsTrigger>
          <TabsTrigger value="vendas-clientes" className="flex-1 sm:flex-none">Vendas e Clientes</TabsTrigger>
          <TabsTrigger value="equipe-atendimento" className="flex-1 sm:flex-none">Equipe</TabsTrigger>
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
