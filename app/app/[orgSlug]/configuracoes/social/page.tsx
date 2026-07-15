import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getSocialConnections } from '@/actions/social-automations'
import { listDataDeletionRequests } from '@/actions/data-deletion'
import SocialConnectClient from './SocialConnectClient'
import DataDeletionRequestsPanel from './DataDeletionRequestsPanel'

export default async function SocialSettingsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { connected?: string; error?: string; msg?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const [connections, deletionRequests] = await Promise.all([
    getSocialConnections(params.orgSlug),
    listDataDeletionRequests(params.orgSlug),
  ])

  // We can't read server-only env in the client component, so resolve the
  // "is the Meta App configured" flag here and pass it down.
  const configured = !!(process.env.INSTAGRAM_APP_ID && process.env.INSTAGRAM_APP_SECRET)
  const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/api/webhooks/instagram`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Instagram · DMs & Comentários</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte uma conta profissional do Instagram para automatizar respostas
          de mensagens diretas e comentários com IA.
        </p>
      </div>

      <SocialConnectClient
        orgSlug={params.orgSlug}
        connections={connections}
        configured={configured}
        webhookUrl={webhookUrl}
        flash={{ connected: searchParams.connected, error: searchParams.error, msg: searchParams.msg }}
      />

      <DataDeletionRequestsPanel orgSlug={params.orgSlug} initialRequests={deletionRequests} />
    </div>
  )
}
