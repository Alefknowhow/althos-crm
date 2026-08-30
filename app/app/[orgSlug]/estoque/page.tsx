import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicSupplies, listClinicSupplyConsumption, listClinicSupplyInvoices, getClinicEstoqueKpis } from '@/actions/clinic-estoque'
import { listClinicProfessionals } from '@/actions/clinic'
import EstoqueClient from './EstoqueClient'
import { PageHeader } from '@/components/ui/page-header'

export default async function EstoquePage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const [supplies, consumption, invoices, kpis, professionals] = await Promise.all([
    listClinicSupplies(params.orgSlug),
    listClinicSupplyConsumption(params.orgSlug),
    listClinicSupplyInvoices(params.orgSlug),
    getClinicEstoqueKpis(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Estoque" hint="Insumos, consumo por atendimento e notas fiscais de entrada." />
      <EstoqueClient
        orgSlug={params.orgSlug}
        initialSupplies={supplies}
        initialConsumption={consumption}
        initialInvoices={invoices}
        initialKpis={kpis}
        professionals={professionals.filter(p => p.active)}
      />
    </div>
  )
}
