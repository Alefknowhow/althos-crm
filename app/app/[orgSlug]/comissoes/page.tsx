import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicCommissions } from '@/actions/clinic-commissions'
import { listClinicProfessionals } from '@/actions/clinic'
import ComissoesClient from './ComissoesClient'
import { PageHeader } from '@/components/ui/page-header'

export default async function ComissoesPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const [commissions, professionals] = await Promise.all([
    listClinicCommissions(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Comissões" hint="Calculadas automaticamente a partir do % cadastrado em cada profissional — orçamentos aprovados, atendimentos e pacotes vendidos." />
      <ComissoesClient
        orgSlug={params.orgSlug}
        initialCommissions={commissions}
        professionals={professionals.filter(p => p.active)}
      />
    </div>
  )
}
