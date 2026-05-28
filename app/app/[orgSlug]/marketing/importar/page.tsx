import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listCampaigns } from '@/actions/marketing'
import CsvImporter from '@/components/features/marketing/CsvImporter'

export const dynamic = 'force-dynamic'

export default async function MarketingImportPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const campaigns = await listCampaigns(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar CSV de campanhas</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cole/envie um arquivo exportado do Meta Ads Manager ou Google Ads.
        </p>
      </div>

      <CsvImporter orgSlug={params.orgSlug} campaigns={campaigns as any[]} />
    </div>
  )
}
