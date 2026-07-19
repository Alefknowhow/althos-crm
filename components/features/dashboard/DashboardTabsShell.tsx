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
      <TabsList>
        <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
        <TabsTrigger value="comercial">Comercial</TabsTrigger>
        <TabsTrigger value="vendas-clientes">Vendas & Clientes</TabsTrigger>
        <TabsTrigger value="equipe-atendimento">Equipe & Atendimento</TabsTrigger>
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
