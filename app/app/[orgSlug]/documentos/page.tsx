import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche, isTrafficNiche } from '@/lib/niche'
import { listDocumentTemplates } from '@/actions/document-templates'
import { listOrgDocuments } from '@/actions/org-documents'
import DocumentosTabs from '@/components/features/documents/DocumentosTabs'
import TravelDocumentsList from '@/components/features/documents/TravelDocumentsList'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function DocumentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const travel = isTravelNiche(org.niche)
  // Tráfego chega aqui pelo link "Criar/editar contratos" do Plano
  // (ProductForm.tsx) — reaproveita a mesma tabela document_templates
  // (genérica, contract_template_id só referencia o id) em vez de duplicar
  // uma tela de modelos própria. Viagens usa um módulo totalmente diferente
  // (upload de PDF pronto + rótulo, sem editor) — ver TravelDocumentsList.
  if (!travel && !isTrafficNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  if (travel) {
    const docs = await listOrgDocuments(params.orgSlug)
    return (
      <div className="flex flex-col h-full gap-4">
        <PageHeader
          title="Documentos"
          hint="Envie o PDF já pronto com um rótulo — depois é só abrir ou imprimir direto da lista."
        />
        <TravelDocumentsList orgSlug={params.orgSlug} initial={docs} />
      </div>
    )
  }

  const templates = await listDocumentTemplates(params.orgSlug)

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Documentos"
        hint="Crie modelos de documentos e contratos reutilizáveis, com campos entre {{chaves}} preenchidos automaticamente."
      />
      <DocumentosTabs
        orgSlug={params.orgSlug}
        templates={templates}
        medifTemplateInfo={null}
        fremecTemplateInfo={null}
        showMedifFremec={false}
      />
    </div>
  )
}
