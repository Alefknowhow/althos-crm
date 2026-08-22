import { redirect } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import PlaceholderPage from '@/components/features/agencias-trafego/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function AgenciaTrafegoVisaoGeralPage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Visão geral em preparação"
      description="A visão geral da agência (clientes, investimento, leads e resultado) aparece aqui assim que essa tela for especificada."
    />
  )
}
