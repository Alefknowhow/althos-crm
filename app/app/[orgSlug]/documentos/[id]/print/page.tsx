import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getGeneratedDocument } from '@/actions/generated-documents'
import DocumentPrintView from '@/components/features/documents/DocumentPrintView'

export const dynamic = 'force-dynamic'

export default async function GeneratedDocumentPrintPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const doc = await getGeneratedDocument(params.orgSlug, params.id)
  if (!doc) notFound()

  return (
    <DocumentPrintView
      doc={doc}
      org={{
        name: org.name,
        logo_url: (org as any).logo_url ?? null,
        primary_color: (org as any).primary_color ?? null,
        cnpj: (org as any).cnpj ?? null,
        cadastur: (org as any).cadastur ?? null,
      }}
    />
  )
}
