import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listRoteiros, listRoteiristaKnowledge } from '@/actions/roteirista'
import RoteiristaView from '@/components/features/roteirista/RoteiristaView'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function RoteiristaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  const [roteiros, knowledge] = await Promise.all([
    listRoteiros(params.orgSlug),
    listRoteiristaKnowledge(params.orgSlug),
  ])

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Roteirista IA"
        hint="Gere roteiros, sugestões de hospedagem ou estimativas de voo com IA — buscando informações reais na web. Não vira cotação automaticamente; use 'Transformar em cotação' quando quiser enviar ao cliente."
      />

      <RoteiristaView orgSlug={params.orgSlug} initialRoteiros={roteiros} initialKnowledge={knowledge} />
    </div>
  )
}
