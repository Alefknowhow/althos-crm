import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isClinicNiche } from '@/lib/niche'
import { notFound } from 'next/navigation'
import { listClinicProfessionals } from '@/actions/clinic'
import ProntuarioClient from './ProntuarioClient'
import { PageHeader } from '@/components/ui/page-header'

// Módulo oculto (lib/niche-modules.ts, PRONTUARIO_ENABLED=false) — a rota
// continua existindo pra permitir teste interno antes de habilitar o menu.
export default async function ProntuarioPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isClinicNiche((org as any).niche)) notFound()

  const professionals = await listClinicProfessionals(params.orgSlug)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prontuário"
        hint="Evoluções clínicas por paciente — dado de saúde sensível (LGPD). Acesso restrito à permissão dedicada."
      />
      <ProntuarioClient orgSlug={params.orgSlug} professionals={professionals.filter(p => p.active)} />
    </div>
  )
}
