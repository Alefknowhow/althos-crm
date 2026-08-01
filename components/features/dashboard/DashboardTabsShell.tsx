'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function DashboardTabsShell({
  visaoGeral,
  comercial,
  vendasClientes,
  equipeAtendimento,
}: {
  visaoGeral: ReactNode
  comercial: ReactNode
  vendasClientes: ReactNode
  equipeAtendimento: ReactNode
}) {
  return (
    <Tabs defaultValue="visao-geral" className="space-y-4">
      <TabsList className="flex-wrap h-auto w-full sm:w-auto">
        <TabsTrigger value="visao-geral" className="flex-1 sm:flex-none">Visão Geral</TabsTrigger>
        <TabsTrigger value="comercial" className="flex-1 sm:flex-none">Comercial</TabsTrigger>
        <TabsTrigger value="vendas-clientes" className="flex-1 sm:flex-none">Vendas e Clientes</TabsTrigger>
        <TabsTrigger value="equipe-atendimento" className="flex-1 sm:flex-none">Equipe</TabsTrigger>
      </TabsList>
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
