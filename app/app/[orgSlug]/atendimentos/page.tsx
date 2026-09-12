import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listClinicAttendances } from '@/actions/clinic-attendances'
import { listClinicProfessionals } from '@/actions/clinic'
import { listEventTypes } from '@/actions/appointments'
import AtendimentosClient from './AtendimentosClient'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export default async function AtendimentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled((org as any).niche, 'atendimentos_clinica')

  const [attendances, professionals, eventTypes] = await Promise.all([
    listClinicAttendances(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
    listEventTypes(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Atendimentos" hint="Histórico operacional de atendimentos — não é prontuário médico." />
      <AtendimentosClient
        orgSlug={params.orgSlug}
        initialAttendances={attendances}
        professionals={professionals.filter(p => p.active)}
        eventTypes={eventTypes as any[]}
      />
    </div>
  )
}
