import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotificationPrefs } from '@/actions/notifications'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import SettingsTabsNav from '../SettingsTabsNav'
import NotificationsClient from './NotificationsClient'

export const dynamic = 'force-dynamic'

export default async function NotificacoesPage({ params }: { params: { orgSlug: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [org, prefs] = await Promise.all([
    getCurrentOrganization(params.orgSlug) as Promise<any>,
    getNotificationPrefs(params.orgSlug),
  ])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <NotificationsClient
        orgSlug={params.orgSlug}
        initialPrefs={prefs}
        isTravel={isTravelNiche(org?.niche)}
      />
    </div>
  )
}
