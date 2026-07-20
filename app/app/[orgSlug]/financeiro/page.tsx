import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listFinancialEntries } from '@/actions/financial'
import FinanceiroTabs from '@/components/features/financial/FinanceiroTabs'
import FinancialDashboard from '@/components/features/financial/FinancialDashboard'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const entries = await listFinancialEntries(params.orgSlug)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        hint="Registre receitas e despesas manualmente ou importe um extrato bancário em CSV. Acompanhe fluxo de caixa, despesas por categoria e o DRE simplificado na aba Dashboard."
      />

      <FinanceiroTabs
        orgSlug={params.orgSlug}
        entries={entries}
        dashboard={<FinancialDashboard orgSlug={params.orgSlug} />}
      />
    </div>
  )
}
