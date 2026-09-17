import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { SalesCoachPaywall } from '@/components/features/sales-coach/SalesCoachPaywall'
import { SalesCoachKnowledgeForm } from '@/components/features/sales-coach/SalesCoachKnowledgeForm'
import { getSalesCoachKnowledge } from '@/actions/sales-coach-knowledge'
import { emptySalesCoachKnowledge } from '@/lib/sales-coach/knowledge'
import { PageHeader } from '@/components/ui/page-header'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Knowledge Base + Objection Library do IA Sales Coach (spec §17/§19).
 * Ainda não conectada a um consumer ao vivo (fatia 5) — o texto salvo aqui
 * já está pronto para ser passado como `orgKnowledge` para
 * lib/sales-coach/{context,event}-engine.ts e next-best-action.ts assim
 * que esse consumer existir.
 */
export default async function SalesCoachConfiguracoesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const hasFeature = await checkFeatureAccessByOrgSlug(params.orgSlug, 'sales_coach')
  if (!hasFeature) return <SalesCoachPaywall orgSlug={params.orgSlug} />

  const result = await getSalesCoachKnowledge(params.orgSlug)
  const knowledge = result.ok ? result.knowledge : emptySalesCoachKnowledge()

  return (
    <div className="space-y-6">
      <PageHeader
        title="IA Sales Coach — Contexto"
        hint="Informe pitch, produtos, diferenciais e objeções conhecidas para a IA usar como referência durante as reuniões."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/${params.orgSlug}/sales-coach`}>
              <ArrowLeft className="w-4 h-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <SalesCoachKnowledgeForm orgSlug={params.orgSlug} initial={knowledge} />
    </div>
  )
}
