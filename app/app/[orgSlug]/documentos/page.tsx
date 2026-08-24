import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche, isTrafficNiche } from '@/lib/niche'
import { listDocumentTemplates } from '@/actions/document-templates'
import { getAttachmentTemplateInfo } from '@/actions/attachment-templates'
import DocumentosTabs from '@/components/features/documents/DocumentosTabs'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function DocumentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const travel = isTravelNiche(org.niche)
  // Tráfego chega aqui pelo link "Criar/editar contratos" do Plano
  // (ProductForm.tsx) — reaproveita a mesma tabela document_templates
  // (genérica, contract_template_id só referencia o id) em vez de duplicar
  // uma tela de modelos própria. MEDIF/FREMEC continuam exclusivos de Viagens.
  if (!travel && !isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [templates, medifTemplateInfo, fremecTemplateInfo] = await Promise.all([
    listDocumentTemplates(params.orgSlug),
    travel ? getAttachmentTemplateInfo(params.orgSlug, 'medif') : Promise.resolve(null),
    travel ? getAttachmentTemplateInfo(params.orgSlug, 'fremec') : Promise.resolve(null),
  ])

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Documentos"
        hint={travel
          ? 'Crie modelos de documentos, imprima preenchendo os campos manualmente, e mantenha os modelos de MEDIF/FREMEC em PDF disponíveis para download.'
          : 'Crie modelos de documentos e contratos reutilizáveis, com campos entre {{chaves}} preenchidos automaticamente.'}
      />
      <DocumentosTabs
        orgSlug={params.orgSlug}
        templates={templates}
        medifTemplateInfo={medifTemplateInfo}
        fremecTemplateInfo={fremecTemplateInfo}
        showMedifFremec={travel}
      />
    </div>
  )
}
