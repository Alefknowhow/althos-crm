'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Package, AlertTriangle, TrendingDown, Boxes } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import {
  type ClinicSupplyRow, type ClinicSupplyConsumptionRow, type ClinicSupplyInvoiceRow, type ClinicEstoqueKpis,
} from '@/actions/clinic-estoque'
import type { ClinicProfessional } from '@/actions/clinic'
import { ItensTab } from './EstoqueItensTab'
import { ConsumoTab } from './EstoqueConsumoTab'
import { NotasTab } from './EstoqueNotasTab'

export default function EstoqueClient({
  orgSlug, initialSupplies, initialConsumption, initialInvoices, initialKpis, professionals,
}: {
  orgSlug: string
  initialSupplies: ClinicSupplyRow[]
  initialConsumption: ClinicSupplyConsumptionRow[]
  initialInvoices: ClinicSupplyInvoiceRow[]
  initialKpis: ClinicEstoqueKpis
  professionals: ClinicProfessional[]
}) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <KpiBar kpis={initialKpis} />
      <Tabs defaultValue="itens">
        <TabsList>
          <TabsTrigger value="itens">Itens</TabsTrigger>
          <TabsTrigger value="consumo">Consumo</TabsTrigger>
          <TabsTrigger value="notas">Notas fiscais</TabsTrigger>
        </TabsList>
        <TabsContent value="itens" className="mt-4">
          <ItensTab orgSlug={orgSlug} supplies={initialSupplies} onChanged={() => router.refresh()} />
        </TabsContent>
        <TabsContent value="consumo" className="mt-4">
          <ConsumoTab orgSlug={orgSlug} initialConsumption={initialConsumption} professionals={professionals} />
        </TabsContent>
        <TabsContent value="notas" className="mt-4">
          <NotasTab orgSlug={orgSlug} initialInvoices={initialInvoices} supplies={initialSupplies} onChanged={() => router.refresh()} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

function KpiBar({ kpis }: { kpis: ClinicEstoqueKpis }) {
  const items = [
    { label: 'Valor total em estoque', value: formatCurrency(kpis.totalStockValueCents), icon: Package },
    { label: 'Itens cadastrados', value: String(kpis.itemCount), icon: Boxes },
    { label: 'Itens com estoque baixo', value: String(kpis.lowStockCount), icon: AlertTriangle, warn: kpis.lowStockCount > 0 },
    { label: 'Consumo no mês (valor)', value: formatCurrency(kpis.consumptionValueThisMonthCents), icon: TrendingDown },
  ]
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(it => (
        <Card key={it.label} className={it.warn ? 'border-amber-400' : undefined}>
          <CardContent className="p-4 flex items-center gap-3">
            <it.icon className={`w-5 h-5 shrink-0 ${it.warn ? 'text-amber-500' : 'text-muted-foreground'}`} strokeWidth={1.75} />
            <div>
              <div className="text-xs text-muted-foreground">{it.label}</div>
              <div className="text-lg font-semibold">{it.value}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
