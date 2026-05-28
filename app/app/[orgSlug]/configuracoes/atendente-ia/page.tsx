import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getAttendantConfig } from '@/actions/ai_attendant'
import { getOrgAIConfig } from '@/actions/organization'
import AttendantConfigForm from '@/components/features/ai/AttendantConfigForm'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function AtendenteIaPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const [config, orgAi] = await Promise.all([
    getAttendantConfig(params.orgSlug),
    getOrgAIConfig(params.orgSlug),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Atendente IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure a personalidade, horário e regras do atendente que responde no WhatsApp.
        </p>
      </div>

      {!orgAi.has_api_key && (
        <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300 mb-1">
            ⚠ Chave da Anthropic ainda não cadastrada
          </p>
          <p className="text-amber-700 dark:text-amber-300">
            O atendente precisa da sua API key da Anthropic para funcionar.{' '}
            <Link
              href={`/app/${params.orgSlug}/configuracoes/ia`}
              className="underline font-medium"
            >
              Cadastre aqui →
            </Link>
          </p>
        </div>
      )}

      <AttendantConfigForm orgSlug={params.orgSlug} initial={config} />
    </div>
  )
}
