import { redirect } from 'next/navigation'
import { UsersRound } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTrafficNiche } from '@/lib/niche'
import PlaceholderPage from '@/components/features/agencias-trafego/PlaceholderPage'

export const dynamic = 'force-dynamic'

export default async function AgenciaTrafegoEquipePage({
  params,
}: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  return (
    <PlaceholderPage
      icon={UsersRound}
      title="Equipe em preparação"
      description="A performance da equipe da agência aparece aqui assim que essa tela for especificada."
    />
  )
}
