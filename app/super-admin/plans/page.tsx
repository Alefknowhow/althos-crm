import { getBillingCatalog } from '@/actions/super-admin'
import { formatPrice } from '@/lib/billing/plans'
import PlanCard from './PlanCard'
import CouponManager from './CouponManager'
import { Package, Ticket } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function PlansPage() {
  const { plans, coupons } = await getBillingCatalog()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Planos &amp; Cupons</h1>
        <p className="text-sm text-slate-500 mt-1">Preços, créditos de IA e cupons de desconto.</p>
      </div>

      {/* Plans */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-violet-400" />
          <h2 className="text-sm font-semibold text-white">Planos</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {plans.map(p => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </div>
      </section>

      {/* Coupons */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <Ticket className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Cupons</h2>
        </div>
        <CouponManager coupons={coupons} planNames={plans.map(p => ({ id: p.id, name: p.name }))} />
      </section>
    </div>
  )
}
