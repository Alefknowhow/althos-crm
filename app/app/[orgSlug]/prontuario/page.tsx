import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { requireModuleEnabled } from '@/lib/module-flags'
import { listClinicProfessionals } from '@/actions/clinic'
import ProntuarioClient from './ProntuarioClient'
import { PageHeader } from '@/components/ui/page-header'

// Módulo oculto por padrão (ver /super-admin/modulos, lib/module-flags.ts)
// até uma decisão de compliance — docs/audit/clinicas-lgpd.md.
export default async function ProntuarioPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled((org as any).niche, 'prontuario_clinica')

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
