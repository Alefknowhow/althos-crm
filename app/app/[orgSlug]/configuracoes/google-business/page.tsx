import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getGoogleBusinessConnections, getGoogleBusinessLocations, type GoogleBusinessLocation } from '@/actions/google-business'
import GoogleBusinessConnectClient from './GoogleBusinessConnectClient'

export const dynamic = 'force-dynamic'

export default async function GoogleBusinessSettingsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { connected?: string; error?: string; msg?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const connections = await getGoogleBusinessConnections(params.orgSlug)

  const locationsByConnection: Record<string, GoogleBusinessLocation[]> = {}
  await Promise.all(connections.map(async c => {
    locationsByConnection[c.id] = await getGoogleBusinessLocations(params.orgSlug, c.id)
  }))

  const configured = !!(process.env.GOOGLE_BUSINESS_CLIENT_ID && process.env.GOOGLE_BUSINESS_CLIENT_SECRET)
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://althoscrm.com.br'}/api/google-business/callback`

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Google Meu Negócio</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Conecte o Perfil da Empresa no Google pra gerenciar avaliações, publicações e indicadores
          direto do CRM.
        </p>
      </div>

      <GoogleBusinessConnectClient
        orgSlug={params.orgSlug}
        connections={connections}
        locationsByConnection={locationsByConnection}
        configured={configured}
        redirectUri={redirectUri}
        flash={{ connected: searchParams.connected, error: searchParams.error, msg: searchParams.msg }}
      />
    </div>
  )
}
