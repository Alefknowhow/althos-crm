import Link from 'next/link'
import { Settings } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { SalesCoachPaywall } from '@/components/features/sales-coach/SalesCoachPaywall'
import { SalesCoachLiveSpike } from '@/components/features/sales-coach/SalesCoachLiveSpike'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export const dynamic = 'force-dynamic'

/**
 * Fatia 1 (spike técnico) do IA Sales Coach — ver
 * .harness/tasks/active/ia-sales-coach.md. Ainda não é a UI final (spec
 * §20 Sales Coach Live): sem briefing, contexto comercial, eventos ou
 * Next Best Action — só a prova ponta a ponta de captura de áudio +
 * transcrição em tempo real via o serviço realtime (Railway).
 */
export default async function SalesCoachPage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)

  const hasFeature = await checkFeatureAccessByOrgSlug(params.orgSlug, 'sales_coach')
  if (!hasFeature) return <SalesCoachPaywall orgSlug={params.orgSlug} />

  const permission = await checkMemberPermission(org.id, user.id, 'sales_coach')
  if (!permission.allowed) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="IA Sales Coach" />
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{permission.reason}</CardContent></Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="IA Sales Coach"
        hint="Copiloto comercial com IA que acompanha suas reuniões em tempo real (versão de teste técnico)."
        actions={
          <Button variant="outline" size="sm" asChild>
            <Link href={`/app/${params.orgSlug}/sales-coach/configuracoes`}>
              <Settings className="w-4 h-4" /> Contexto da empresa
            </Link>
          </Button>
        }
      />
      <SalesCoachLiveSpike orgSlug={params.orgSlug} />
    </div>
  )
}
