import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTrafficNiche } from '@/lib/niche'
import { getTrafficClientProfile } from '@/actions/traffic-client-profile'
import { listAdAccountsByClient, listCampaignsByClient } from '@/actions/marketing'
import { listCreatives } from '@/actions/campaign-creatives'
import ClientDetailShell from '@/components/features/agencias-trafego/ClientDetailShell'

export const dynamic = 'force-dynamic'

export default async function TrafficClientDetailPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const supabase = createClient()
  const { data: client } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('id', params.id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!client) redirect(`/app/${params.orgSlug}/agencias-trafego/trafego`)

  const [profile, accounts, campaigns, creatives, { data: sales }] = await Promise.all([
    getTrafficClientProfile(params.orgSlug, params.id),
    listAdAccountsByClient(params.orgSlug, params.id),
    listCampaignsByClient(params.orgSlug, params.id),
    listCreatives(params.orgSlug, params.id),
    supabase
      .from('sales')
      .select('id, sale_date, amount_cents, status, products(name)')
      .eq('contato_id', params.id)
      .eq('organization_id', org.id)
      .order('sale_date', { ascending: false }),
  ])

  return (
    <ClientDetailShell
      orgSlug={params.orgSlug}
      clientId={client.id}
      clientName={client.name}
      profile={profile}
      accounts={accounts as any[]}
      campaigns={campaigns as any[]}
      creatives={creatives}
      sales={(sales || []) as any[]}
    />
  )
}
