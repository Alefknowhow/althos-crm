import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getQuotationFull } from '@/actions/quotations'
import { listOrgMembers } from '@/actions/team'
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

  const quotation = full.quotation as any

  // Vendedor — só o que já existe (nome/e-mail via profiles); não há
  // telefone de vendedor nem link de pagamento por cotação no modelo atual,
  // então esses campos simplesmente não aparecem no documento (ver seção
  // "campos opcionais" do QuotationPrintView).
  const members = quotation.created_by ? await listOrgMembers(params.orgSlug) : []
  const seller = quotation.created_by ? members.find(m => m.user_id === quotation.created_by) : null

  // Produtos passam pro documento no formato genérico que eles já têm no
  // banco (quotation_products) — nada de achatar em listas por tipo aqui;
  // o QuotationPrintView tem seu próprio registry type → card.
  const products = (full.products || []).map((p: any) => ({
    id: p.id as string,
    type: p.product_type as string,
    name: p.name as string | null,
    summary: p.summary as string | null,
    date_start: p.date_start as string | null,
    date_end: p.date_end as string | null,
    data: (p.data || {}) as Record<string, any>,
  }))

  return (
    <QuotationPrintView
      quotation={quotation}
      products={products}
      seller={seller ? { name: seller.name, email: seller.email } : null}
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
