import Link from 'next/link'
import { Lock, FileBarChart } from 'lucide-react'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { minimumPlanFor, getPlanMeta } from '@/lib/plans/config'
import { isTravelNiche } from '@/lib/niche'
import ReportsClient from '@/components/features/reports/ReportsClient'

export const dynamic = 'force-dynamic'

export default async function RelatoriosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug) as any
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'export_reports')

  if (!allowed) {
    const minPlan = minimumPlanFor('export_reports')
    const planLabel = minPlan ? getPlanMeta(minPlan).name : 'Business'
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Exporte seus dados em PDF e Excel.</p>
        </div>
        <div className="rounded-xl border bg-card p-10 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-semibold">Exportação de relatórios é um recurso do plano {planLabel}</h2>
            <p className="text-sm text-muted-foreground">
              Faça upgrade para exportar relatórios de leads, vendas e agendamentos em PDF e Excel.
            </p>
          </div>
          <Link
            href={`/app/${params.orgSlug}/upgrade`}
            className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Ver planos
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileBarChart className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Relatórios</h1>
          <p className="text-muted-foreground text-sm">
            Escolha o período e exporte em PDF ou Excel.
          </p>
        </div>
      </div>

      <ReportsClient orgSlug={params.orgSlug} isTravel={isTravelNiche(org.niche)} />
    </div>
  )
}
