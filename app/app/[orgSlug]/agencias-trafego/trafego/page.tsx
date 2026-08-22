import { redirect } from 'next/navigation'
import { Target } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import PlaceholderPage from '@/components/features/agencias-trafego/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function AgenciaTrafegoTrafegoPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  return (
    <PlaceholderPage
      icon={Target}
      title="Nenhuma campanha conectada ainda"
      description="Investimento, campanhas e mídia aparecem aqui assim que essa tela for especificada."
    />
  )
}
