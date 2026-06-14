import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getAttendantConfig } from '@/actions/ai_attendant'
import AttendantConfigForm from '@/components/features/ai/AttendantConfigForm'

export const dynamic = 'force-dynamic'

export default async function AtendenteIaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const config = await getAttendantConfig(params.orgSlug)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atendente IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a personalidade, horário e regras do atendente que responde no WhatsApp.
        </p>
      </div>

      <AttendantConfigForm orgSlug={params.orgSlug} initial={config} />
    </div>
  )
}
