import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getQuotationFull } from '@/actions/quotations'
import QuotationPrintView from '@/components/features/quotations/QuotationPrintView'

export const dynamic = 'force-dynamic'

export default async function QuotationPrintPage({
  params,
}: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const full = await getQuotationFull(params.orgSlug, params.id)
  if (!full) notFound()

  return (
    <QuotationPrintView
      quotation={full.quotation as any}
      lodgings={full.lodgings as any}
      flights={full.flights as any}
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
