import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listClinicQuotes } from '@/actions/clinic-quotes'
import { listClinicProfessionals } from '@/actions/clinic'
import { listEventTypes } from '@/actions/appointments'
import OrcamentosClient from './OrcamentosClient'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export default async function OrcamentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled((org as any).niche, 'orcamentos_clinica')

  const [quotes, professionals, eventTypes] = await Promise.all([
    listClinicQuotes(params.orgSlug),
    listClinicProfessionals(params.orgSlug),
    listEventTypes(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader title="Orçamentos" hint="Orçamentos de serviços e procedimentos para pacientes." />
      <OrcamentosClient
        orgSlug={params.orgSlug}
        initialQuotes={quotes}
        professionals={professionals.filter(p => p.active)}
        eventTypes={eventTypes as any[]}
      />
    </div>
  )
}
