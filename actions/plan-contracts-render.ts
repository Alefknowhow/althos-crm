'use server'

/**
 * Plan contract (Agências de Tráfego) render/edit — building the printable
 * HTML from a sale + product template, and saving edited content.
 * Split out of actions/plan-contracts.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { renderTemplate } from '@/lib/inngest/functions'

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

export async function getPlanContractRenderData(orgSlug: string, saleId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: sale } = await supabase
    .from('sales')
    .select('id, amount_cents, sale_date, payment_method, service_start_date, duration_months, contatos(name, email, phone), products(name, contract_template_id)')
    .eq('id', saleId).eq('organization_id', org.id).maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const client: any = (sale as any).contatos
  const product: any = (sale as any).products
  const startDate = sale.service_start_date ? new Date(sale.service_start_date + 'T12:00:00') : null
  const endDate = startDate && sale.duration_months
    ? new Date(startDate.getFullYear(), startDate.getMonth() + sale.duration_months, startDate.getDate())
    : null

  const planoSale = {
    id: sale.id,
    client_name: client?.name || '',
    client_email: client?.email || null,
    client_phone: client?.phone || null,
    plano: product?.name || '',
    valor_mensal_cents: sale.amount_cents,
    duracao_meses: sale.duration_months,
    data_inicio: sale.service_start_date,
    data_fim: endDate ? endDate.toISOString().slice(0, 10) : null,
    forma_pagamento: sale.payment_method,
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

  // Prioridade: conteúdo editado manualmente PRA ESTA VENDA (plan_contracts.
  // body_html) > modelo padrão do produto > fallback genérico renderizado no
  // componente. Cada contrato pode ter cláusulas diferentes — editar aqui
  // não altera o modelo que os outros contratos usam.
  const { data: existingContract } = await supabase
    .from('plan_contracts')
    .select('body_html')
    .eq('sale_id', saleId).eq('organization_id', org.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (existingContract?.body_html) {
    return { ok: true as const, hasTemplate: true as const, bodyHtml: existingContract.body_html, sale: planoSale, org: orgBranding }
  }

  const templateId = product?.contract_template_id
  if (templateId) {
    const { data: template } = await supabase.from('document_templates').select('body_html').eq('id', templateId).eq('organization_id', org.id).maybeSingle()
    if (template) {
      const bodyHtml = renderTemplate(template.body_html, {
        sale: {
          cliente: planoSale.client_name,
          plano: planoSale.plano,
          valor_mensal: fmtCurrencyBr(planoSale.valor_mensal_cents),
          duracao_meses: planoSale.duracao_meses ? String(planoSale.duracao_meses) : '',
          data_inicio: fmtDateBr(planoSale.data_inicio),
          data_fim: fmtDateBr(planoSale.data_fim),
          forma_pagamento: planoSale.forma_pagamento || '',
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
      return { ok: true as const, hasTemplate: true as const, bodyHtml, sale: planoSale, org: orgBranding }
    }
  }
  return { ok: true as const, hasTemplate: false as const, sale: planoSale, org: orgBranding }
}

/** HTML inicial pra abrir no editor quando o contrato ainda não tem
 *  conteúdo próprio nem modelo padrão — mesmo texto do fallback renderizado
 *  em PlanContractPrintView, só que como string editável. */
function buildDefaultPlanContractHtml(sale: { client_name: string; plano: string; valor_mensal_cents: number; duracao_meses: number | null; data_inicio: string | null; data_fim: string | null; forma_pagamento: string | null }): string {
  return [
    `<h1 style="text-align:center;font-weight:700;font-size:18px;">Contrato de Prestação de Serviços</h1>`,
    `<p>Pelo presente instrumento, a CONTRATADA e <strong>${sale.client_name}</strong>, doravante CONTRATANTE, ajustam a prestação do serviço abaixo descrito.</p>`,
    `<table style="width:100%;border-collapse:collapse;">`,
    `<tbody>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Plano</td><td style="padding:4px 0;">${sale.plano}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Mensalidade</td><td style="padding:4px 0;">${fmtCurrencyBr(sale.valor_mensal_cents)}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Duração</td><td style="padding:4px 0;">${sale.duracao_meses ? `${sale.duracao_meses} meses` : '—'}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Início</td><td style="padding:4px 0;">${fmtDateBr(sale.data_inicio) || '—'}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Término previsto</td><td style="padding:4px 0;">${fmtDateBr(sale.data_fim) || '—'}</td></tr>`,
    `<tr><td style="padding:4px 0;font-weight:600;">Forma de pagamento</td><td style="padding:4px 0;">${sale.forma_pagamento || '—'}</td></tr>`,
    `</tbody>`,
    `</table>`,
  ].join('\n')
}

/** Conteúdo pronto pra abrir no editor (Tiptap) — sempre retorna algo
 *  editável, mesmo sem template configurado. */
export async function getPlanContractEditableBody(orgSlug: string, saleId: string) {
  const data = await getPlanContractRenderData(orgSlug, saleId)
  if (!data.ok) return data
  const bodyHtml = data.hasTemplate ? data.bodyHtml! : buildDefaultPlanContractHtml(data.sale)
  return { ok: true as const, bodyHtml }
}

/** Salva o conteúdo editado pra ESTA venda — não mexe no modelo padrão do
 *  produto. Próxima geração de PDF já usa esse conteúdo (ver
 *  getPlanContractRenderData acima). */
export async function savePlanContractBody(orgSlug: string, saleId: string, bodyHtml: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: existing } = await supabase
    .from('plan_contracts')
    .select('id, status')
    .eq('sale_id', saleId).eq('organization_id', org.id)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()

  if (existing) {
    if (existing.status === 'sent' || existing.status === 'signed') {
      return { ok: false as const, error: 'Este contrato já foi enviado/assinado — não é possível editar o conteúdo.' }
    }
    const { error } = await supabase.from('plan_contracts').update({ body_html: bodyHtml, updated_at: new Date().toISOString() }).eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await supabase.from('plan_contracts').insert({
      organization_id: org.id, sale_id: saleId, body_html: bodyHtml, status: 'draft', created_by: user.id,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/vendas`)
  return { ok: true as const }
}

export async function getPlanSaleContract(orgSlug: string, saleId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('plan_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data
}
