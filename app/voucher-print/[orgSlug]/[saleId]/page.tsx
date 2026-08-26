import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { isTravelNiche } from '@/lib/niche'
import { getTravelSale } from '@/actions/travel-sales'
import VoucherPrintView from '@/components/features/reservas/VoucherPrintView'

export const dynamic = 'force-dynamic'

/**
 * Voucher imprimível. Fica FORA da árvore /app/[orgSlug] pra não herdar o
 * sidebar/header do CRM — só o layout raiz (html/body). Aberto em nova aba;
 * o botão "Imprimir" dispara o print → salvar como PDF do navegador.
 */
export default async function VoucherPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const sale = await getTravelSale(params.orgSlug, params.saleId)
  if (!sale) notFound()

  // Vendas criadas pelo novo fluxo (voucher → OCR → Produtos) podem não ter
  // mais os campos flat legados (hotel_name/airline) preenchidos — sintetiza
  // a partir de sale_products só quando o campo flat está vazio. Os voos vão
  // direto (com trechos/conexões/check-in/bilhete/bagagem) pro VoucherPrintView,
  // que já sabe renderizar o detalhe completo por trecho.
  const { listSaleProducts } = await import('@/actions/sale-products')
  const products = await listSaleProducts(params.orgSlug, params.saleId)
  const aereos = products.filter(p => p.kind === 'aereo')
  const hospedagens = products.filter(p => p.kind === 'hospedagem')
  const transfers = products.filter(p => p.kind === 'transfer')
  const cruzeiros = products.filter(p => p.kind === 'cruzeiro')
  const ingressos = products.filter(p => p.kind === 'ingresso' || p.kind === 'passeio')
  const seguros = products.filter(p => p.kind === 'seguro')
  if (products.length > 0) {
    if (aereos.length > 0) {
      if (!sale.airline) sale.airline = aereos[0].data?.companhia ?? null
      if (!sale.air_locator) sale.air_locator = aereos[0].data?.localizador ?? null
    }
    if (!sale.hotel_name && hospedagens[0]) {
      sale.hotel_name = hospedagens[0].data?.hotel ?? null
      if (!sale.hotel_locator) sale.hotel_locator = hospedagens[0].data?.localizador ?? null
    }
  }

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
      voos={aereos as any}
      hospedagens={hospedagens as any}
      transfers={transfers as any}
      cruzeiros={cruzeiros as any}
      ingressos={ingressos as any}
      seguros={seguros as any}
      org={{
        name: org.name,
        logo_url: (org as any).logo_url ?? null,
        primary_color: (org as any).primary_color ?? null,
        cnpj: (org as any).cnpj ?? null,
        cadastur: (org as any).cadastur ?? null,
        contact_phone: (org as any).contact_phone ?? null,
        contact_email: (org as any).contact_email ?? null,
        website: (org as any).website ?? null,
        address_street: (org as any).address_street ?? null,
        address_city: (org as any).address_city ?? null,
        address_state: (org as any).address_state ?? null,
        address_zip: (org as any).address_zip ?? null,
      }}
    />
  )
}
