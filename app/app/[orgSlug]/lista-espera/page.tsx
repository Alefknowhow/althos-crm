import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicWaitlist } from '@/actions/clinic-waitlist'
import { listClinicProfessionals } from '@/actions/clinic'
import { listEventTypes } from '@/actions/appointments'
import ListaEsperaClient from './ListaEsperaClient'
import { PageHeader } from '@/components/ui/page-header'

export default async function ListaEsperaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const [entries, professionals, eventTypes] = await Promise.all([
    listClinicWaitlist(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
    listEventTypes(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Lista de Espera" hint="Pacientes aguardando vaga com profissional/serviço/período preferidos. Contato é sempre manual." />
      <ListaEsperaClient
        orgSlug={params.orgSlug}
        initialEntries={entries}
        professionals={professionals.filter(p => p.active)}
        eventTypes={eventTypes as any[]}
      />
    </div>
  )
}
