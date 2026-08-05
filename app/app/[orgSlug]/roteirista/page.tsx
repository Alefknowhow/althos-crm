import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listRoteiros, listRoteiristaKnowledge } from '@/actions/roteirista'
import { TRAVEL_PLANNER_ENABLED } from '@/lib/ai/roteirista'
import RoteiristaView from '@/components/features/roteirista/RoteiristaView'
import { PageHeader } from '@/components/ui/page-header'
import EmptyState from '@/components/ui/empty-state'
import { Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function RoteiristaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  if (!isTravelNiche(org.niche)) {
    redirect(`/app/${params.orgSlug}`)
  }

  if (!TRAVEL_PLANNER_ENABLED) {
    return (
      <div className="flex flex-col h-full gap-4">
        <PageHeader title="Travel Planner" hint="Temporariamente desativado." />
        <EmptyState
          icon={Sparkles}
          title="Travel Planner está pausado por enquanto"
          description="O custo de tokens da busca na web ficou alto pra um resultado que dá pra reproduzir de graça pesquisando direto no chat do Gemini. A tela volta assim que fizer sentido reativar."
        />
      </div>
    )
  }

  const [roteiros, knowledge] = await Promise.all([
    listRoteiros(params.orgSlug),
    listRoteiristaKnowledge(params.orgSlug),
  ])

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Travel Planner"
        hint="Gere roteiros, sugestões de hospedagem ou estimativas de voo com IA — buscando informações reais na web. Não vira cotação automaticamente; use 'Transformar em cotação' quando quiser enviar ao cliente."
      />

      <RoteiristaView orgSlug={params.orgSlug} initialRoteiros={roteiros} initialKnowledge={knowledge} />
    </div>
  )
}
