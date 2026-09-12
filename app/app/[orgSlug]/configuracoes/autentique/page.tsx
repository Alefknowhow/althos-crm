import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getOrgAutentiqueConfig } from '@/actions/contracts'
import AutentiqueConfigForm from '@/components/features/ai/AutentiqueConfigForm'

export default async function AutentiqueConfigPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const config = await getOrgAutentiqueConfig(params.orgSlug)
  // Lido só no servidor — nunca passa no bundle client como constante, só
  // como valor de prop já resolvido (ver .harness/invariants.md sobre secrets).
  const webhookToken = process.env.AUTENTIQUE_WEBHOOK_TOKEN || null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Autentique — Assinatura Digital</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure sua chave de API da Autentique para enviar contratos de Reservas
          para assinatura digital direto do CRM.
        </p>
      </div>
      <AutentiqueConfigForm orgSlug={params.orgSlug} initial={config} webhookToken={webhookToken} />
    </div>
  )
}
