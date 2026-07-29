import { redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { listDocumentTemplates } from '@/actions/document-templates'
import { getAttachmentTemplateInfo } from '@/actions/attachment-templates'
import DocumentosTabs from '@/components/features/documents/DocumentosTabs'
import { PageHeader } from '@/components/ui/page-header'

export const dynamic = 'force-dynamic'

export default async function DocumentosPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const [templates, medifTemplateInfo, fremecTemplateInfo] = await Promise.all([
    listDocumentTemplates(params.orgSlug),
    getAttachmentTemplateInfo(params.orgSlug, 'medif'),
    getAttachmentTemplateInfo(params.orgSlug, 'fremec'),
  ])

  return (
    <div className="flex flex-col h-full gap-4">
      <PageHeader
        title="Documentos"
        hint="Crie modelos de documentos, imprima preenchendo os campos manualmente, e mantenha os modelos de MEDIF/FREMEC em PDF disponíveis para download."
      />
      <DocumentosTabs
        orgSlug={params.orgSlug}
        templates={templates}
        medifTemplateInfo={medifTemplateInfo}
        fremecTemplateInfo={fremecTemplateInfo}
      />
    </div>
  )
}
