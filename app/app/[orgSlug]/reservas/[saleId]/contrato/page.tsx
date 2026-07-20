import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getTravelSale, markContractGenerated } from '@/actions/travel-sales'
import ContractPrintView from '@/components/features/reservas/ContractPrintView'

export const dynamic = 'force-dynamic'

export default async function ContractPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const sale = await getTravelSale(params.orgSlug, params.saleId)
  if (!sale) notFound()

  await markContractGenerated(params.orgSlug, params.saleId)

  return (
    <ContractPrintView
      sale={sale}
      org={{
        name: org.name,
        logo_url: (org as any).logo_url ?? null,
        primary_color: (org as any).primary_color ?? null,
        cnpj: (org as any).cnpj ?? null,
        cadastur: (org as any).cadastur ?? null,
        contact_phone: (org as any).contact_phone ?? null,
        contact_email: (org as any).contact_email ?? null,
        address_street: (org as any).address_street ?? null,
      }}
    />
  )
}
