import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTravelNiche } from '@/lib/niche'
import { getTravelSale } from '@/actions/travel-sales'
import VoucherPrintView from '@/components/features/reservas/VoucherPrintView'

export const dynamic = 'force-dynamic'

export default async function VoucherPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const sale = await getTravelSale(params.orgSlug, params.saleId)
  if (!sale) notFound()

  let contato: { phone: string | null; email: string | null } | null = null
  if (sale.contato_id) {
    const supabase = createClient()
    const { data } = await supabase
      .from('contatos')
      .select('phone, email')
      .eq('id', sale.contato_id)
      .eq('organization_id', org.id)
      .maybeSingle()
    contato = data as any
  }

  return (
    <VoucherPrintView
      sale={sale}
      contato={contato}
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
