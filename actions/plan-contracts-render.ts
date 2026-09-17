'use server'

/**
 * Plan contract (Agências de Tráfego) render/edit — building the printable
 * HTML from the client (Agência↔Cliente) + org branding, and saving
 * edited content. O contrato é firmado assim que o contato vira cliente —
 * não tem relação com vendas específicas (ver createCustomer,
 * actions/contatos-contactpoints.ts, que já cria a linha em draft).
 * Split out of actions/plan-contracts.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

export async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

function fmtDateBr(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : ''
}
function fmtCurrencyBr(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

export async function getPlanContractRenderData(orgSlug: string, contatoId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: client } = await supabase
    .from('contatos')
    .select('id, name, email, phone, traffic_client_profile')
    .eq('id', contatoId).eq('organization_id', org.id).maybeSingle()
  if (!client) return { ok: false as const, error: 'Cliente não encontrado.' }

  const profile: any = client.traffic_client_profile || {}

  const planoSale = {
    id: contatoId,
    client_name: client.name || '',
    client_email: client.email || null,
    client_phone: client.phone || null,
    plano: 'Gestão de Tráfego Pago',
    valor_mensal_cents: profile.monthlyBudgetCents ?? null,
    duracao_meses: null as number | null,
    data_inicio: profile.contractStart ?? null,
    data_fim: null as string | null,
    forma_pagamento: null as string | null,
  }

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

  // Prioridade: conteúdo editado manualmente PRA ESTE CLIENTE
  // (plan_contracts.body_html) > fallback genérico renderizado no
  // componente. O contrato é único por cliente (Agência↔Cliente), não por
  // venda — não existe mais "modelo do produto" aqui (não há produto).
  const { data: existingContract } = await supabase
    .from('plan_contracts')
    .select('body_html')
    .eq('contato_id', contatoId).eq('organization_id', org.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existingContract?.body_html) {
    return { ok: true as const, hasTemplate: true as const, bodyHtml: existingContract.body_html, sale: planoSale, org: orgBranding }
  }

  return { ok: true as const, hasTemplate: false as const, sale: planoSale, org: orgBranding }
}

/** HTML inicial pra abrir no editor quando o contrato ainda não tem
 *  conteúdo próprio — mesmo texto do fallback renderizado em
 *  PlanContractPrintView, só que como string editável. */
function buildDefaultPlanContractHtml(sale: { client_name: string; plano: string; valor_mensal_cents: number | null; duracao_meses: number | null; data_inicio: string | null; data_fim: string | null; forma_pagamento: string | null }): string {
  return [
    `<h1 style="text-align:center;font-weight:700;font-size:18px;">Contrato de Prestação de Serviços</h1>`,
    `<p>Pelo presente instrumento, a CONTRATADA e <strong>${sale.client_name}</strong>, doravante CONTRATANTE, ajustam a prestação do serviço de gestão de tráfego pago abaixo descrito.</p>`,
    `<table style="width:100%;border-collapse:collapse;">`,
    `<tbody>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Serviço</td><td style="padding:4px 0;">${sale.plano}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Fee mensal</td><td style="padding:4px 0;">${sale.valor_mensal_cents != null ? fmtCurrencyBr(sale.valor_mensal_cents) : '—'}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Início</td><td style="padding:4px 0;">${fmtDateBr(sale.data_inicio) || '—'}</td></tr>`,
    `</tbody>`,
    `</table>`,
  ].join('\n')
}

/** Conteúdo pronto pra abrir no editor (Tiptap) — sempre retorna algo
 *  editável, mesmo sem conteúdo próprio salvo ainda. */
export async function getPlanContractEditableBody(orgSlug: string, contatoId: string) {
  const data = await getPlanContractRenderData(orgSlug, contatoId)
  if (!data.ok) return data
  const bodyHtml = data.hasTemplate ? data.bodyHtml! : buildDefaultPlanContractHtml(data.sale)
  return { ok: true as const, bodyHtml }
}

/** Salva o conteúdo editado do contrato deste cliente. */
export async function savePlanContractBody(orgSlug: string, contatoId: string, bodyHtml: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('plan_contracts')
    .select('id, status')
    .eq('contato_id', contatoId).eq('organization_id', org.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (existing) {
    if (existing.status === 'sent' || existing.status === 'signed') {
      return { ok: false as const, error: 'Este contrato já foi enviado/assinado — não é possível editar o conteúdo.' }
    }
    const { error } = await supabase.from('plan_contracts').update({ body_html: bodyHtml, updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await supabase.from('plan_contracts').insert({
      organization_id: org.id, contato_id: contatoId, body_html: bodyHtml, status: 'draft', created_by: user.id,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/agencias-trafego/trafego/${contatoId}`)
  return { ok: true as const }
}

export async function getPlanSaleContract(orgSlug: string, contatoId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('plan_contracts')
    .select('*')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
