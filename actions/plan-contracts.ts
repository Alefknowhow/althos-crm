'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { createAutentiqueDocument, getAutentiqueDocumentStatus, isDocumentSignedByKnownSigners } from '@/lib/autentique'
import { getResend, clientEmailFrom } from '@/lib/resend'
import { renderTemplate } from '@/lib/inngest/functions'
import { getApiKeyOrFail } from '@/actions/contracts'

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

/**
 * Contrato de assinatura de plano (Agências de Tráfego) — tabela própria
 * (plan_contracts, migration 0194), NÃO compartilhada com sale_contracts
 * (Reservas/Viagens). Mesma estrutura/fluxo (Autentique), copiada, não
 * reaproveitada por referência — só a credencial de API (getApiKeyOrFail)
 * é compartilhada, por ser configuração da organização, não dado de
 * contrato.
 */

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

export async function uploadPlanContractPdf(orgSlug: string, saleId: string, base64Pdf: string) {
  const { org, user } = await requireAccess(orgSlug)
  const supabase = createClient()

  const bytes = Buffer.from(base64Pdf, 'base64')
  const path = `${org.id}/${saleId}/${Date.now()}-contrato.pdf`

  const { error: uploadError } = await supabase.storage
    .from('plan-contracts')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { data: existing } = await supabase
    .from('plan_contracts')
    .select('id')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('plan_contracts')
      .update({ pdf_path: path, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await supabase.from('plan_contracts').insert({
      organization_id: org.id,
      sale_id: saleId,
      pdf_path: path,
      status: 'draft',
      created_by: user.id,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/vendas`)
  return { ok: true as const }
}

export async function sendPlanContractForSignature(
  orgSlug: string,
  saleId: string,
  signer: { name: string; email?: string; phone?: string },
  signer2: { name: string; email?: string; phone?: string },
) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const keyRes = await getApiKeyOrFail(org.id)
  if (!keyRes.ok) return keyRes

  const { data: contract } = await supabase
    .from('plan_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.pdf_path) return { ok: false as const, error: 'Gere o PDF do contrato antes de enviar.' }
  if (!signer.email && !signer.phone) return { ok: false as const, error: 'Informe e-mail ou telefone do cliente.' }
  if (!signer2.email && !signer2.phone) return { ok: false as const, error: 'Informe e-mail ou telefone do signatário da agência.' }

  const { data: file, error: downloadError } = await supabase.storage
    .from('plan-contracts')
    .download(contract.pdf_path)
  if (downloadError || !file) return { ok: false as const, error: downloadError?.message || 'Não foi possível ler o PDF salvo.' }

  const { data: sale } = await supabase.from('sales').select('id, products(name)').eq('id', saleId).maybeSingle()
  const docTitle = (sale as any)?.products?.name || saleId

  try {
    const doc = await createAutentiqueDocument(
      keyRes.apiKey,
      `Contrato ${docTitle}`,
      [
        { name: signer.name, email: signer.email, phone: signer.phone },
        { name: signer2.name, email: signer2.email, phone: signer2.phone },
      ],
      file,
      'contrato.pdf',
    )
    const link = doc.signatures?.[0]?.link?.short_link || null

    const { error } = await supabase
      .from('plan_contracts')
      .update({
        status: 'sent',
        autentique_document_id: doc.id,
        signature_link: link,
        signer_name: signer.name,
        signer_email: signer.email || null,
        signer_phone: signer.phone || null,
        signer2_name: signer2.name,
        signer2_email: signer2.email || null,
        signer2_phone: signer2.phone || null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id)
    if (error) return { ok: false as const, error: error.message }

    revalidatePath(`/app/${orgSlug}/vendas`)
    return { ok: true as const, link }
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'Erro ao enviar para assinatura na Autentique.' }
  }
}

export async function refreshPlanContractStatus(orgSlug: string, saleId: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const keyRes = await getApiKeyOrFail(org.id)
  if (!keyRes.ok) return keyRes

  const { data: contract } = await supabase
    .from('plan_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.autentique_document_id) return { ok: false as const, error: 'Contrato ainda não foi enviado para assinatura.' }

  try {
    const doc = await getAutentiqueDocumentStatus(keyRes.apiKey, contract.autentique_document_id)
    if (!doc) {
      console.error('refreshPlanContractStatus: Autentique retornou documento nulo', { documentId: contract.autentique_document_id })
      return { ok: false as const, error: 'Documento não encontrado na Autentique. Confira se ele ainda existe na sua conta.' }
    }
    const signed = isDocumentSignedByKnownSigners(doc, [contract.signer_email, contract.signer2_email])
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (signed) {
      if (contract.status !== 'signed') {
        updates.status = 'signed'
        updates.signed_at = new Date().toISOString()
      }
      if (doc.files?.signed && !contract.signed_pdf_path) {
        updates.signed_pdf_path = doc.files.signed
      }
    }
    await supabase.from('plan_contracts').update(updates).eq('id', contract.id)
    revalidatePath(`/app/${orgSlug}/vendas`)
    return { ok: true as const, status: updates.status || contract.status }
  } catch (e: any) {
    console.error('refreshPlanContractStatus error:', e)
    return { ok: false as const, error: e.message || 'Erro ao consultar status na Autentique.' }
  }
}

export async function getPlanContractFileUrl(orgSlug: string, saleId: string, which: 'pdf' | 'signed' = 'pdf') {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('plan_contracts')
    .select('pdf_path, signed_pdf_path')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const path = which === 'signed' ? contract?.signed_pdf_path : contract?.pdf_path
  if (!path) return { ok: false as const, error: 'Arquivo não encontrado.' }

  if (which === 'signed' && /^https?:\/\//.test(path)) {
    return { ok: true as const, url: path }
  }

  const { data: signed, error } = await supabase.storage.from('plan-contracts').createSignedUrl(path, 60 * 5)
  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL.' }
  return { ok: true as const, url: signed.signedUrl }
}

export async function sendPlanContractLinkByEmail(orgSlug: string, saleId: string, toEmail: string) {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('plan_contracts')
    .select('signature_link')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.signature_link) return { ok: false as const, error: 'Envie o contrato para assinatura primeiro.' }

  try {
    await getResend().emails.send({
      from: clientEmailFrom(org.name),
      to: toEmail,
      subject: 'Contrato para assinatura',
      html: `<p>Olá! Segue o link para assinatura do seu contrato:</p><p><a href="${contract.signature_link}">${contract.signature_link}</a></p>`,
    })
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'Erro ao enviar e-mail.' }
  }
}
