'use server'

/**
 * Sale contract (Reservas/Viagens) render data + Autentique API-key config.
 * Split out of actions/contracts.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { getTravelSale, markContractGenerated } from '@/actions/travel-sales'
import { getOrgContractTemplate } from '@/actions/document-templates'
import { renderTemplate } from '@/lib/inngest/functions'

export async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

// ─── Dados pra renderizar o contrato fora da página de print (usado pra
// gerar o PDF direto no dialog, sem iframe — a CSP do app bloqueia
// frame-ancestors mesmo same-origin, então a página de print não pode ser
// embutida em iframe) ─────────────────────────────────────────────────────

function fmtDateBr(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''
}
function fmtCurrencyBr(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export async function getContractRenderData(orgSlug: string, saleId: string) {
  const { org } = await requireAccess(orgSlug)

  const sale = await getTravelSale(orgSlug, saleId)
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  await markContractGenerated(orgSlug, saleId)

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

  const template = await getOrgContractTemplate(orgSlug)

  if (template) {
    const bodyHtml = renderTemplate(template.body_html, {
      sale: {
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
    return { ok: true as const, hasTemplate: true as const, bodyHtml, sale, org: orgBranding }
  }

  return { ok: true as const, hasTemplate: false as const, sale, org: orgBranding }
}

// ─── Chave de API (Configurações > Integrações) ──────────────────────────────
// Compartilhada entre Reservas (Viagens) e Planos (Tráfego) — é uma
// credencial da integração Autentique da organização, não um dado de
// contrato; os dados/tabelas de contrato em si são separados
// (sale_contracts vs. plan_contracts).

export async function getOrgAutentiqueConfig(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'settings')
  if (!check.allowed) return { has_api_key: false }
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('autentique_api_key')
    .eq('id', org.id)
    .maybeSingle()

  return { has_api_key: !!data?.autentique_api_key }
}

export async function saveOrgAutentiqueConfig(orgSlug: string, apiKey: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'settings')
  if (!check.allowed) return { ok: false as const, error: check.reason || 'Sem permissão' }
  const supabase = createClient()

  if (!apiKey.trim()) return { ok: false as const, error: 'Informe a chave de API.' }

  const { error } = await supabase
    .from('organizations')
    .update({ autentique_api_key: apiKey.trim() })
    .eq('id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/autentique`)
  return { ok: true as const }
}

export async function getApiKeyOrFail(orgId: string) {
  const supabase = createClient()
  const { data } = await supabase
    .from('organizations')
    .select('autentique_api_key')
    .eq('id', orgId)
    .maybeSingle()
  if (!data?.autentique_api_key) {
    return { ok: false as const, error: 'Configure a chave da API Autentique em Configurações > Integrações.' }
  }
  return { ok: true as const, apiKey: data.autentique_api_key as string }
}

// ─── Contrato da venda (Reservas / Viagens — travel_sales) ────────────────

export async function getSaleContract(orgSlug: string, saleId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('sale_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
