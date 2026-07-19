import { requireAuth } from '@/lib/supabase/types'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { listSales, listActiveProducts, listOrgMembers } from '@/actions/sales'
import SalesTable from '@/components/features/sales/SalesTable'
import SaleDialog from '@/components/features/sales/SaleDialog'
import { formatCurrency } from '@/lib/utils'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function VendasPage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  const [sales, products, members] = await Promise.all([
    listSales(params.orgSlug),
    listActiveProducts(params.orgSlug),
    listOrgMembers(params.orgSlug),
  ])

  // Quick KPIs (current month)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const monthSales = sales.filter((s: any) => s.sale_date >= monthStart && s.status === 'completed')
  const monthTotal = monthSales.reduce((acc: number, s: any) => acc + (s.amount_cents || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vendas"
        hint="Registro de produtos e serviços vendidos."
        actions={
          <SaleDialog
            orgSlug={params.orgSlug}
            members={members}
            products={products}
            currentUserId={user.id}
            trigger={
              <Button title="Registrar venda" aria-label="Registrar venda">
                <Plus className="w-4 h-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Registrar venda</span>
              </Button>
            }
          />
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-none p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Vendas no mês</div>
          <div className="text-2xl font-bold mt-1.5 tabular-nums">{monthSales.length}</div>
        </div>
        <div className="bg-card border rounded-none p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Faturamento (mês)</div>
          <div className="text-2xl font-bold mt-1.5 tabular-nums">{formatCurrency(monthTotal)}</div>
        </div>
        <div className="bg-card border rounded-none p-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total registradas</div>
          <div className="text-2xl font-bold mt-1.5 tabular-nums">{sales.length}</div>
        </div>
      </div>

      <SalesTable
        orgSlug={params.orgSlug}
        sales={sales}
        members={members}
        products={products}
        currentUserId={user.id}
      />
    </div>
  )
}
