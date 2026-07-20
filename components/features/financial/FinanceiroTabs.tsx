'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import FinancialEntriesView from './FinancialEntriesView'
import type { FinancialEntryRow } from '@/actions/financial'

export default function FinanceiroTabs({
  orgSlug, entries, dashboard,
}: {
  orgSlug: string
  entries: FinancialEntryRow[]
  dashboard: React.ReactNode
}) {
  return (
    <Tabs defaultValue="lancamentos">
      <TabsList>
        <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
        <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
      </TabsList>
      <TabsContent value="lancamentos">
        <FinancialEntriesView orgSlug={orgSlug} entries={entries} />
      </TabsContent>
      <TabsContent value="dashboard">
        {dashboard}
      </TabsContent>
    </Tabs>
  )
}
