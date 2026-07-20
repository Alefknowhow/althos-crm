import { notFound, redirect } from 'next/navigation'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { isTravelNiche } from '@/lib/niche'
import { getTravelSale, markContractGenerated } from '@/actions/travel-sales'
import { getOrgContractTemplate } from '@/actions/document-templates'
import { renderTemplate } from '@/lib/inngest/functions'
import ContractPrintView from '@/components/features/reservas/ContractPrintView'
import ContractTemplatePrintView from '@/components/features/reservas/ContractTemplatePrintView'

export const dynamic = 'force-dynamic'

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''
}
function fmtCurrency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export default async function ContractPrintPage({
  params,
}: { params: { orgSlug: string; saleId: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  if (!isTravelNiche(org.niche)) redirect(`/app/${params.orgSlug}`)

  const sale = await getTravelSale(params.orgSlug, params.saleId)
  if (!sale) notFound()

  await markContractGenerated(params.orgSlug, params.saleId)

  const orgBranding = {
    name: org.name,
    logo_url: (org as any).logo_url ?? null,
    primary_color: (org as any).primary_color ?? null,
    cnpj: (org as any).cnpj ?? null,
    cadastur: (org as any).cadastur ?? null,
    contact_phone: (org as any).contact_phone ?? null,
    contact_email: (org as any).contact_email ?? null,
    address_street: (org as any).address_street ?? null,
  }

  const template = await getOrgContractTemplate(params.orgSlug)

  if (template) {
    const bodyHtml = renderTemplate(template.body_html, {
      sale: {
        cliente: sale.client_name || '',
        destino: sale.destination || '',
        hotel: sale.hotel_name || '',
        data_ida: fmtDate(sale.departure_date),
        data_volta: fmtDate(sale.return_date),
        valor_total: fmtCurrency(sale.total_cents),
        forma_pagamento: sale.payment_method || '',
        operadora: sale.operator || '',
        companhia_aerea: sale.airline || '',
        localizador_pacote: sale.package_locator || '',
        localizador_aereo: sale.air_locator || '',
        politica_cancelamento: sale.cancellation_policy || '',
        informacoes_importantes: sale.important_info || '',
        informacoes_servico: sale.service_info || '',
        observacoes: sale.notes || '',
      },
      org: {
        nome: org.name,
        cnpj: orgBranding.cnpj || '',
        cadastur: orgBranding.cadastur || '',
        telefone: orgBranding.contact_phone || '',
        email: orgBranding.contact_email || '',
        endereco: orgBranding.address_street || '',
      },
    })

    return (
      <ContractTemplatePrintView
        saleId={sale.id}
        orgSlug={params.orgSlug}
        bodyHtml={bodyHtml}
        org={{ name: org.name, logo_url: orgBranding.logo_url, primary_color: orgBranding.primary_color, cnpj: orgBranding.cnpj, cadastur: orgBranding.cadastur }}
      />
    )
  }

  return (
    <ContractPrintView
      sale={sale}
      orgSlug={params.orgSlug}
      org={orgBranding}
    />
  )
}
