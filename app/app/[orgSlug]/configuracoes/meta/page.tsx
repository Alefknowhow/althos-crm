import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getOrgMetaConfig } from '@/actions/organization'
import MetaConfigForm from '@/components/features/ai/MetaConfigForm'

export default async function MetaConfigPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const config = await getOrgMetaConfig(params.orgSlug)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meta / Facebook Pixel & CAPI</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure o Pixel ID e o Access Token para enviar eventos de conversão
          ao Meta Ads — tanto pelo browser (Pixel) quanto pelo servidor (CAPI).
        </p>
      </div>
      <MetaConfigForm orgSlug={params.orgSlug} initial={config} />
    </div>
  )
}
