import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicProfessionals, listClinicSpecialties, listClinicRooms } from '@/actions/clinic'
import ProfissionaisClient from './ProfissionaisClient'
import { PageHeader } from '@/components/ui/page-header'

export default async function ProfissionaisPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const [professionals, specialties, rooms] = await Promise.all([
    listClinicProfessionals(params.orgSlug),
    listClinicSpecialties(params.orgSlug),
    listClinicRooms(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profissionais"
        hint="Profissionais, especialidades e salas da clínica."
      />
      <ProfissionaisClient
        orgSlug={params.orgSlug}
        initialProfessionals={professionals}
        initialSpecialties={specialties}
        initialRooms={rooms}
      />
    </div>
  )
}
