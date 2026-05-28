import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getOrgAIConfig } from '@/actions/organization'
import AIConfigForm from '@/components/features/ai/AIConfigForm'

export default async function IAConfigPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const config = await getOrgAIConfig(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">IA Qualificadora</h1>
        <p className="text-muted-foreground text-sm">
          Configura a IA que classifica seus leads automaticamente quando chegam por formulário.
        </p>
      </div>

      <AIConfigForm orgSlug={params.orgSlug} initial={config} />
    </div>
  )
}
