import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicTreatments } from '@/actions/clinic-treatments'
import { listClinicPackages } from '@/actions/clinic-packages'
import { listClinicProfessionals } from '@/actions/clinic'
import { listEventTypes } from '@/actions/appointments'
import TratamentosClient from './TratamentosClient'
import { PageHeader } from '@/components/ui/page-header'

export default async function TratamentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const [treatments, packages, professionals, eventTypes] = await Promise.all([
    listClinicTreatments(params.orgSlug),
    listClinicPackages(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
    listEventTypes(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Tratamentos e Pacotes" hint="Planos de múltiplas sessões e pacotes de sessões pré-pagos." />
      <TratamentosClient
        orgSlug={params.orgSlug}
        initialTreatments={treatments}
        initialPackages={packages}
        professionals={professionals.filter(p => p.active)}
        eventTypes={eventTypes as any[]}
      />
    </div>
  )
}
