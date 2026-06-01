import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listCustomers } from '@/actions/customers'
import CustomersSplit from '@/components/features/customers/CustomersSplit'
import AddCustomerDialog from '@/components/features/customers/AddCustomerDialog'
import EmptyState from '@/components/ui/empty-state'
import { Users } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function CustomersPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const customers = await listCustomers(params.orgSlug)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Leads que efetivaram pelo menos uma compra. Marca automática quando você registra uma
            venda, ou manual pelo botão no detalhe do lead.
          </p>
        </div>
        <AddCustomerDialog orgSlug={params.orgSlug} />
      </div>

      {customers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Quando você registrar a primeira venda de um lead, ele aparece aqui automaticamente — ou adicione um cliente manualmente pelo botão acima."
          actionLabel="Ver Leads"
          actionHref={`/app/${params.orgSlug}/leads`}
        />
      ) : (
        <CustomersSplit orgSlug={params.orgSlug} customers={customers} />
      )}
    </div>
  )
}
