'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'
import { createAutentiqueDocument, getAutentiqueDocumentStatus } from '@/lib/autentique'
import { sendWhatsappMessage } from '@/actions/whatsapp'
import { getResend, clientEmailFrom } from '@/lib/resend'

// ─── Chave de API (Configurações > Integrações) ──────────────────────────────

export async function getOrgAutentiqueConfig(orgSlug: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('autentique_api_key')
    .eq('id', org.id)
    .maybeSingle()

  return { has_api_key: !!data?.autentique_api_key }
}

export async function saveOrgAutentiqueConfig(orgSlug: string, apiKey: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
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

async function getApiKeyOrFail(orgId: string) {
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

// ─── Contrato da venda ────────────────────────────────────────────────────

export async function getSaleContract(orgSlug: string, saleId: string) {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
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

export async function uploadContractPdf(orgSlug: string, saleId: string, base64Pdf: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const bytes = Buffer.from(base64Pdf, 'base64')
  const path = `${org.id}/${saleId}/${Date.now()}-contrato.pdf`

  const { error: uploadError } = await supabase.storage
    .from('sale-contracts')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return { ok: false as const, error: uploadError.message }

  const { data: existing } = await supabase
    .from('sale_contracts')
    .select('id')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('sale_contracts')
      .update({ pdf_path: path, status: 'draft', updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    if (error) return { ok: false as const, error: error.message }
  } else {
    const { error } = await supabase.from('sale_contracts').insert({
      organization_id: org.id,
      sale_id: saleId,
      pdf_path: path,
      status: 'draft',
      created_by: user.id,
    })
    if (error) return { ok: false as const, error: error.message }
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}

export async function sendContractForSignature(
  orgSlug: string,
  saleId: string,
  signer: { name: string; email?: string; phone?: string },
) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const keyRes = await getApiKeyOrFail(org.id)
  if (!keyRes.ok) return keyRes

  const { data: contract } = await supabase
    .from('sale_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.pdf_path) return { ok: false as const, error: 'Gere o PDF do contrato antes de enviar.' }
  if (!signer.email && !signer.phone) return { ok: false as const, error: 'Informe e-mail ou telefone do signatário.' }

  const { data: file, error: downloadError } = await supabase.storage
    .from('sale-contracts')
    .download(contract.pdf_path)
  if (downloadError || !file) return { ok: false as const, error: downloadError?.message || 'Não foi possível ler o PDF salvo.' }

  const { data: sale } = await supabase.from('travel_sales').select('sale_number').eq('id', saleId).maybeSingle()

  try {
    const doc = await createAutentiqueDocument(
      keyRes.apiKey,
      `Contrato ${sale?.sale_number || saleId}`,
      { name: signer.name, email: signer.email, phone: signer.phone },
      file,
      'contrato.pdf',
    )
    const link = doc.signatures?.[0]?.link?.short_link || null

    const { error } = await supabase
      .from('sale_contracts')
      .update({
        status: 'sent',
        autentique_document_id: doc.id,
        signature_link: link,
        signer_name: signer.name,
        signer_email: signer.email || null,
        signer_phone: signer.phone || null,
        sent_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', contract.id)
    if (error) return { ok: false as const, error: error.message }

    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, link }
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'Erro ao enviar para assinatura na Autentique.' }
  }
}

export async function refreshContractStatus(orgSlug: string, saleId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const keyRes = await getApiKeyOrFail(org.id)
  if (!keyRes.ok) return keyRes

  const { data: contract } = await supabase
    .from('sale_contracts')
    .select('*')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.autentique_document_id) return { ok: false as const, error: 'Contrato ainda não foi enviado para assinatura.' }

  try {
    const doc = await getAutentiqueDocumentStatus(keyRes.apiKey, contract.autentique_document_id)
    const signed = doc?.signatures?.every(s => !!s.signed)
    const updates: Record<string, any> = { updated_at: new Date().toISOString() }
    if (signed && contract.status !== 'signed') {
      updates.status = 'signed'
      updates.signed_at = new Date().toISOString()
      if (doc?.files?.signed) updates.signed_pdf_path = doc.files.signed
      await supabase.from('travel_sales').update({ contrato_assinado_at: new Date().toISOString() }).eq('id', saleId).eq('organization_id', org.id)
    }
    await supabase.from('sale_contracts').update(updates).eq('id', contract.id)
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, status: updates.status || contract.status }
  } catch (e: any) {
    return { ok: false as const, error: e.message || 'Erro ao consultar status na Autentique.' }
  }
}

export async function getContractFileUrl(orgSlug: string, saleId: string, which: 'pdf' | 'signed' = 'pdf') {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('sale_contracts')
    .select('pdf_path, signed_pdf_path')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const path = which === 'signed' ? contract?.signed_pdf_path : contract?.pdf_path
  if (!path) return { ok: false as const, error: 'Arquivo não encontrado.' }

  // O PDF assinado devolvido pela Autentique é uma URL pública deles, não um
  // path do nosso Storage — nesse caso é só repassar a URL.
  if (which === 'signed' && /^https?:\/\//.test(path)) {
    return { ok: true as const, url: path }
  }

  const { data: signed, error } = await supabase.storage.from('sale-contracts').createSignedUrl(path, 60 * 5)
  if (error || !signed?.signedUrl) return { ok: false as const, error: error?.message || 'Não foi possível assinar URL.' }
  return { ok: true as const, url: signed.signedUrl }
}

export async function sendContractLinkByWhatsapp(orgSlug: string, saleId: string, conversationId: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('sale_contracts')
    .select('signature_link')
    .eq('sale_id', saleId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!contract?.signature_link) return { ok: false as const, error: 'Envie o contrato para assinatura primeiro.' }

  return sendWhatsappMessage(orgSlug, conversationId, `Segue o link para assinatura do seu contrato: ${contract.signature_link}`)
}

export async function sendContractLinkByEmail(orgSlug: string, saleId: string, toEmail: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('sale_contracts')
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
