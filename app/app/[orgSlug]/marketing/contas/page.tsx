import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listAdAccounts } from '@/actions/marketing'
import AdAccountsManager from '@/components/features/marketing/AdAccountsManager'

export const dynamic = 'force-dynamic'

export default async function MarketingAccountsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const accounts = await listAdAccounts(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contas de anúncio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cadastre suas contas de Meta, Google, TikTok. Cada conta agrupa campanhas.
        </p>
      </div>

      <AdAccountsManager orgSlug={params.orgSlug} initial={accounts as any[]} />
    </div>
  )
}
