/**
 * Registry de campos de mesclagem por origem de contrato (issue #60,
 * passo B.1) — usado por `createContract` (`actions/contracts-global.ts`)
 * pra preencher `fieldValues` automaticamente quando há `templateId` +
 * entidade de origem. Placeholders no template usam dot-path
 * (`{{sale.destino}}`, `{{org.nome}}` — ver `renderTemplate` em
 * `lib/inngest/functions.ts`), então cada entrada aqui devolve um objeto
 * aninhado, não chaves flat.
 */

import type { RelatedEntityType } from '@/actions/contracts-global'

export type MergeFieldValues = Record<string, Record<string, string>>

function fmtDateBr(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''
}
function fmtCurrencyBr(cents: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(((cents ?? 0) / 100))
}

async function resolveOrgFields(supabase: any, orgId: string): Promise<Record<string, string>> {
  const { data: org } = await supabase
    .from('organizations')
    .select('name, cnpj, cadastur, contact_phone, contact_email, address_street')
    .eq('id', orgId).maybeSingle()
  return {
    nome: org?.name || '',
    cnpj: org?.cnpj || '',
    cadastur: org?.cadastur || '',
    telefone: org?.contact_phone || '',
    email: org?.contact_email || '',
    endereco: org?.address_street || '',
  }
}

async function resolveReservaFields(supabase: any, orgId: string, saleId: string): Promise<Record<string, string>> {
  const { data: sale } = await supabase.from('travel_sales').select('*').eq('id', saleId).eq('organization_id', orgId).maybeSingle()
  if (!sale) return {}
  return {
    cliente: sale.client_name || '',
    destino: sale.destination || '',
    hotel: sale.hotel_name || '',
    data_ida: fmtDateBr(sale.departure_date),
    data_volta: fmtDateBr(sale.return_date),
    valor_total: fmtCurrencyBr(sale.total_cents),
    forma_pagamento: sale.payment_method || '',
    operadora: sale.operator || '',
    companhia_aerea: sale.airline || '',
    localizador_pacote: sale.package_locator || '',
    localizador_aereo: sale.air_locator || '',
    politica_cancelamento: sale.cancellation_policy || '',
    informacoes_importantes: sale.important_info || '',
    informacoes_servico: sale.service_info || '',
    observacoes: sale.notes || '',
  }
}

/** Venda (Core/Tráfego) — inclui os campos de plano recorrente
 *  (`service_start_date`/`duration_months`) que `plan-contracts-render.ts`
 *  já usava, agora expostos pelo registry global. */
async function resolveVendaFields(supabase: any, orgId: string, saleId: string): Promise<Record<string, string>> {
  const { data: sale } = await supabase
    .from('sales')
    .select('*, contatos(name, email, phone), products(name)')
    .eq('id', saleId).eq('organization_id', orgId).maybeSingle()
  if (!sale) return {}
  return {
    cliente: sale.contatos?.name || '',
    email: sale.contatos?.email || '',
    telefone: sale.contatos?.phone || '',
    produto: sale.products?.name || '',
    valor_total: fmtCurrencyBr(sale.amount_cents),
    data_venda: fmtDateBr(sale.sale_date),
    data_inicio_servico: fmtDateBr(sale.service_start_date),
    duracao_meses: sale.duration_months != null ? String(sale.duration_months) : '',
  }
}

async function resolveContatoFields(supabase: any, orgId: string, contatoId: string): Promise<Record<string, string>> {
  const { data: contato } = await supabase
    .from('contatos').select('name, email, phone, cpf, value_cents')
    .eq('id', contatoId).eq('organization_id', orgId).maybeSingle()
  if (!contato) return {}
  return {
    nome: contato.name || '',
    email: contato.email || '',
    telefone: contato.phone || '',
    documento: contato.cpf || '',
    valor: fmtCurrencyBr(contato.value_cents),
  }
}

/** Resolve os campos de mesclagem pra uma origem — `entityId` é o id da
 *  linha na tabela correspondente (`travel_sales.id`, `sales.id`,
 *  `contatos.id`). Nunca lança: origem não encontrada devolve objeto vazio
 *  (o template só mostra placeholders vazios, não quebra a criação). */
export async function resolveMergeFields(
  supabase: any,
  orgId: string,
  entityType: RelatedEntityType,
  entityId: string,
): Promise<MergeFieldValues> {
  const org = await resolveOrgFields(supabase, orgId)

  switch (entityType) {
    case 'reserva':
      return { sale: await resolveReservaFields(supabase, orgId, entityId), org }
    case 'venda':
      return { sale: await resolveVendaFields(supabase, orgId, entityId), org }
    case 'oportunidade':
    case 'cliente':
      return { sale: await resolveContatoFields(supabase, orgId, entityId), org }
    case 'projeto':
      return { sale: {}, org }
  }
}
