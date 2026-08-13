import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotificationPrefs } from '@/actions/notifications'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
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
    <NotificationsClient
      orgSlug={params.orgSlug}
      initialPrefs={prefs}
      isTravel={isTravelNiche(org?.niche)}
    />
  )
}
