import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listFinancialEntries } from '@/actions/financial'
import { listFinancialSettings } from '@/actions/financial-settings'
import FinanceiroTabs from '@/components/features/financial/FinanceiroTabs'
import FinancialDashboard from '@/components/features/financial/FinancialDashboard'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function FinanceiroPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const [entries, settings] = await Promise.all([
    listFinancialEntries(params.orgSlug),
    listFinancialSettings(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financeiro"
        hint="Registre receitas e despesas manualmente ou importe um extrato bancário em CSV. Acompanhe fluxo de caixa, despesas por categoria e o DRE simplificado na aba Dashboard. Cadastre categorias, contas e centros de custo na aba Configurações."
      />

      <FinanceiroTabs
        orgSlug={params.orgSlug}
        entries={entries}
        settings={settings}
        dashboard={<FinancialDashboard orgSlug={params.orgSlug} />}
      />
    </div>
  )
}
