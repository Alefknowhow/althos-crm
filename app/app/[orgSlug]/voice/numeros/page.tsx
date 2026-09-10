import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listOrgNumbers } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Hash } from 'lucide-react'
import { VoiceNumbersClient } from '@/components/features/voice/VoiceNumbersClient'

export const dynamic = 'force-dynamic'

export default async function VoiceNumerosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await listOrgNumbers(params.orgSlug)
  const numbers = result.ok ? result.numbers : []

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Números" hint="Números de telefone comprados e atribuídos à sua organização." />

      {numbers.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Hash className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">Nenhum número configurado ainda. Compre um número para começar a ligar e receber chamadas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-none border divide-y">
          {numbers.map((n: any) => (
            <div key={n.id} className="p-4 flex items-center justify-between">
              <div>
                <div className="font-medium">{n.e164_number}</div>
                <div className="text-xs text-muted-foreground">
                  {n.capabilities?.voice && 'Voz'}{n.capabilities?.voice && n.capabilities?.sms && ' · '}{n.capabilities?.sms && 'SMS'}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <VoiceNumbersClient orgSlug={params.orgSlug} />
    </div>
  )
}
