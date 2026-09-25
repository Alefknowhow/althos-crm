import { listContracts, listRecentContractEvents } from '@/actions/contracts-global'
import { listDocumentTemplates } from '@/actions/document-templates'
import { getOrgAutentiqueConfig } from '@/actions/contracts-render'
import ContractsListView from '@/components/features/contracts/ContractsListView'

// Mesma constante/convenção de app/app/[orgSlug]/configuracoes/autentique
// (AutentiqueConfigForm) — a chave/token são geridos lá; aqui só exibimos a
// mesma URL, sem duplicar a lógica de configuração.
const WEBHOOK_BASE_URL = 'https://www.althoscrm.com.br/api/webhooks/autentique'

export default async function ContratosPage({ params }: { params: { orgSlug: string } }) {
  const [contracts, templates, autentiqueConfig, recentEvents] = await Promise.all([
    listContracts(params.orgSlug),
    listDocumentTemplates(params.orgSlug).catch(() => []),
    getOrgAutentiqueConfig(params.orgSlug),
    listRecentContractEvents(params.orgSlug),
  ])

  const webhookToken = process.env.AUTENTIQUE_WEBHOOK_TOKEN || null
  const webhookUrl = webhookToken ? `${WEBHOOK_BASE_URL}?token=${webhookToken}` : WEBHOOK_BASE_URL

  return (
    <div className="p-4 md:p-6">
      <ContractsListView
        orgSlug={params.orgSlug}
        initialContracts={contracts}
        templates={templates}
        hasAutentiqueKey={autentiqueConfig.has_api_key}
        webhookUrl={webhookUrl}
        recentEvents={recentEvents}
      />
    </div>
  )
}
