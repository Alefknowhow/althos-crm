import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { getOrgContractTemplate, getDefaultContractBody } from '@/actions/document-templates'
import ContractTemplateEditor from '@/components/features/reservas/ContractTemplateEditor'
import { PageHeader } from '@/components/ui/page-header'
import { requireModuleEnabled } from '@/lib/module-flags'

export const dynamic = 'force-dynamic'

export default async function ContractTemplatePage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  await requireModuleEnabled(org.niche, 'reservas')

  const [template, defaultBody] = await Promise.all([
    getOrgContractTemplate(params.orgSlug),
    getDefaultContractBody(),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contrato padrão"
        hint="Defina o texto do contrato usado ao clicar em 'Gerar contrato' numa venda — os campos entre chaves são preenchidos automaticamente com os dados da venda."
      />
      <ContractTemplateEditor orgSlug={params.orgSlug} initialBody={template?.body_html || defaultBody} />
    </div>
  )
}
