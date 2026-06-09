import { getPlatformAccounts, getBillingCatalog } from '@/actions/super-admin'
import AccountsTable from './AccountsTable'
import type { PlanOption } from './AccountPlanDialog'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const [accounts, catalog] = await Promise.all([
    getPlatformAccounts(),
    getBillingCatalog(),
  ])

  const plans: PlanOption[] = (catalog.plans ?? []).map(p => ({
    id:                  p.id,
    name:                p.name,
    max_leads_per_month: p.max_leads_per_month,
    max_users:           p.max_users,
    ai_credits_monthly:  p.ai_credits_monthly,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Usuários &amp; Contas</h1>
        <p className="text-sm text-slate-500 mt-1">
          Cada conta tem um dono e uma assinatura. Gerencie plano, limites, créditos e acesso por conta.
        </p>
      </div>
      <AccountsTable accounts={accounts} plans={plans} />
    </div>
  )
}
