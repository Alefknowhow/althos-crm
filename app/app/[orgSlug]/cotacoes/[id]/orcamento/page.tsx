import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getBudgetDocument } from '@/actions/budget-documents'
import BudgetDocumentPrintView from '@/components/features/quotations/BudgetDocumentPrintView'

export const dynamic = 'force-dynamic'

export default async function BudgetDocumentPrintPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const doc = await getBudgetDocument(params.orgSlug, params.id)
  if (!doc) notFound()

  return (
    <BudgetDocumentPrintView
      doc={doc}
      org={{
        name: org.name,
        logo_url: (org as any).logo_url ?? null,
        primary_color: (org as any).primary_color ?? null,
        cnpj: (org as any).cnpj ?? null,
        cadastur: (org as any).cadastur ?? null,
        contact_phone: (org as any).contact_phone ?? null,
        contact_email: (org as any).contact_email ?? null,
        website: (org as any).website ?? null,
      }}
    />
  )
}
