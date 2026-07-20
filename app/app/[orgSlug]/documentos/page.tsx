import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listDocumentTemplates } from '@/actions/document-templates'
import { listGeneratedDocuments } from '@/actions/generated-documents'
import DocumentosTabs from '@/components/features/documents/DocumentosTabs'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function DocumentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [templates, documents] = await Promise.all([
    listDocumentTemplates(params.orgSlug),
    listGeneratedDocuments(params.orgSlug),
  ])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Documentos"
        hint="Crie modelos de documentos (MEDIF, autorização de menor viajando, declarações etc.) e gere documentos preenchendo os campos manualmente."
      />
      <DocumentosTabs orgSlug={params.orgSlug} templates={templates} documents={documents} />
    </div>
  )
}
