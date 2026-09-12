import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listClinicReturns } from '@/actions/clinic-returns'
import RetornosClient from './RetornosClient'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export default async function RetornosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled((org as any).niche, 'retornos_clinica')

  const returns = await listClinicReturns(params.orgSlug)

  return (
    <div className="space-y-6">
      <PageHeader title="Retornos" hint="Pacientes com retorno sugerido após o atendimento — crie a tarefa, marque como agendado ou dispense." />
      <RetornosClient orgSlug={params.orgSlug} initialReturns={returns} />
    </div>
  )
}
