'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import FinancialEntriesView from './FinancialEntriesView'
import FinancialSettingsView from './FinancialSettingsView'
import type { FinancialEntryRow } from '@/actions/financial'
import type { FinancialSettingType, FinancialSettingRow } from '@/actions/financial-settings'

export default function FinanceiroTabs({
  orgSlug, entries, settings, dashboard,
}: {
  orgSlug: string
  entries: FinancialEntryRow[]
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  dashboard: React.ReactNode
}) {
  return (
    <Tabs defaultValue="lancamentos">
      <TabsList>
        <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
        <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
      </TabsList>
      <TabsContent value="lancamentos">
        <FinancialEntriesView orgSlug={orgSlug} entries={entries} settings={settings} />
      </TabsContent>
      <TabsContent value="dashboard">
        {dashboard}
      </TabsContent>
      <TabsContent value="configuracoes">
        <FinancialSettingsView orgSlug={orgSlug} settings={settings} />
      </TabsContent>
    </Tabs>
  )
}
