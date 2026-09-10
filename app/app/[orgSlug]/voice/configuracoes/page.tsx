import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { getVoiceAccountSettings } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { VoiceSettingsForm } from '@/components/features/voice/VoiceSettingsForm'

export const dynamic = 'force-dynamic'

export default async function VoiceConfiguracoesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await getVoiceAccountSettings(params.orgSlug)
  const account = result.ok ? result.account : null

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" hint="Gravações, limites de segurança e provider do Althos Voice." />
      <VoiceSettingsForm
        orgSlug={params.orgSlug}
        initialRecordingPolicy={account?.recording_policy || 'off'}
        initialLimits={account?.limits || {}}
      />
    </div>
  )
}
