import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { getCallFullDetail } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { VoiceCallDetailTabs } from '@/components/features/voice/VoiceCallDetailTabs'
import { notFound } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function VoiceCallDetailPage({ params }: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await getCallFullDetail(params.orgSlug, params.id)
  if (!result.ok) notFound()
  const call = result.call as any

  return (
    <div className="space-y-6">
      <PageHeader title={call.contatos?.name || 'Número desconhecido'} />
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-4 text-sm">
          <span>{call.contatos?.phone || call.to_number}</span>
          <span className="text-muted-foreground">{new Date(call.created_at).toLocaleString('pt-BR')}</span>
          <Badge variant="outline">{call.duration_seconds ? `${Math.floor(call.duration_seconds / 60)}m ${call.duration_seconds % 60}s` : '—'}</Badge>
          {call.human_or_ai === 'ai' && call.voice_ai_agents?.name && <Badge>Voice AI — {call.voice_ai_agents.name}</Badge>}
        </CardContent>
      </Card>
      <VoiceCallDetailTabs orgSlug={params.orgSlug} call={call} />
    </div>
  )
}
