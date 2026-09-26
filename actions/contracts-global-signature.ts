'use server'

/**
 * Camada de assinatura eletrônica do módulo global de Contratos (issue #16
 * §11) — reaproveita o mesmo client Autentique (lib/autentique.ts) e a
 * mesma chave BYOK (organizations.autentique_api_key) que Reservas/Tráfego
 * já usam, sem duplicar integração. Upload de PDF via StorageService (R2),
 * não os buckets Supabase legados de sale_contracts/plan_contracts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { StorageService } from '@/lib/storage'
import { uploadFile } from './storage-upload'
import { createAutentiqueDocument, getAutentiqueDocumentStatus, isDocumentSignedByKnownSigners, type AutentiqueSigner } from '@/lib/autentique'
import { getResend, clientEmailFrom } from '@/lib/resend'
import { revalidatePath } from 'next/cache'
import { inngest } from '@/lib/inngest/client'

async function requireContractsAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'contracts')
  return { user, org, perm }
}

/** Resolve um contato pro motor de automação (issue #60, B.6) — o gatilho
 *  genérico exige leadId; um contrato não tem contato direto (relaciona-se
 *  por related_entity_type/id, que pode ser reserva/venda/oportunidade/
 *  projeto), então usa o primeiro signatário vinculado a um Contato do CRM.
 *  Sem isso, a automação simplesmente não dispara (handleAutomationEvent já
 *  ignora eventos sem leadId). */
async function resolveContractLeadId(supabase: ReturnType<typeof createClient>, contractId: string): Promise<string | null> {
  const { data } = await supabase
    .from('contract_signers')
    .select('contato_id')
    .eq('contract_id', contractId)
    .not('contato_id', 'is', null)
    .order('sort_order')
    .limit(1)
    .maybeSingle()
  return data?.contato_id ?? null
}

/** Gera o PDF (client já converteu o HTML via html2canvas+jsPDF, mesmo
 *  mecanismo do ContratoManagerDialog de Reservas — não reimplementado aqui)
 *  e envia direto pra assinatura, num só passo — evita um estado
 *  intermediário "PDF subiu mas ninguém foi notificado". */
export async function sendContractForSignature(orgSlug: string, contractId: string, base64Pdf: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, title, status')
    .eq('id', contractId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contract) return { ok: false as const, error: 'Contrato não encontrado' }
  if (contract.status === 'signed' || contract.status === 'cancelled') {
    return { ok: false as const, error: 'Este contrato já está encerrado.' }
  }

  const { data: signers } = await supabase
    .from('contract_signers')
    .select('id, name, email, phone')
    .eq('contract_id', contractId)
    .order('sort_order')
  if (!signers || signers.length === 0) return { ok: false as const, error: 'Adicione ao menos um signatário antes de enviar.' }
  const missingContact = signers.find(s => !s.email && !s.phone)
  if (missingContact) return { ok: false as const, error: `Informe e-mail ou telefone de "${missingContact.name}".` }

  const { data: org2 } = await supabase.from('organizations').select('autentique_api_key').eq('id', org.id).maybeSingle()
  if (!org2?.autentique_api_key) {
    return { ok: false as const, error: 'Configure a chave da Autentique em Configurações antes de enviar contratos.' }
  }

  const upload = await uploadFile(orgSlug, {
    category: 'documents',
    scopeId: contractId,
    filename: 'contrato.pdf',
    contentType: 'application/pdf',
    base64: base64Pdf,
  })
  if (!upload.ok) return { ok: false as const, error: upload.error }

  await supabase.from('contracts').update({ pdf_storage_object_id: upload.objectId }).eq('id', contractId)

  const buffer = Buffer.from(base64Pdf, 'base64')
  const pdfBlob = new Blob([buffer], { type: 'application/pdf' })

  const autentiqueSigners: AutentiqueSigner[] = signers.map(s => ({ name: s.name, email: s.email || undefined, phone: s.phone || undefined }))

  try {
    const doc = await createAutentiqueDocument(org2.autentique_api_key, contract.title, autentiqueSigners, pdfBlob, 'contrato.pdf')

    // Signatures voltam na mesma ordem em que os signatários foram enviados
    // — a API DA VERDADE devolve link por signatário (confirmado ao ler
    // createAutentiqueDocument: já pede link { short_link } por assinatura),
    // então cada um agora salva o próprio (contract_signers.signature_link),
    // não só o primeiro.
    const docSignatures = (doc.signatures || []) as { public_id: string; email?: string; link?: { short_link?: string } }[]
    for (let i = 0; i < signers.length; i++) {
      const link = docSignatures[i]?.link?.short_link || null
      await supabase.from('contract_signers').update({ status: 'sent', signature_link: link }).eq('id', signers[i].id)
      if (i === 0 && link) {
        await supabase.from('contracts').update({ signature_link: link }).eq('id', contractId)
      }
    }

    await supabase.from('contracts').update({
      status: 'sent',
      autentique_document_id: doc.id,
      sent_at: new Date().toISOString(),
    }).eq('id', contractId)

    await supabase.from('contract_events').insert({ organization_id: org.id, contract_id: contractId, type: 'contract.sent', payload: { autentique_document_id: doc.id } })
    const { syncReservaContractTimestamps } = await import('./contracts-origin')
    await syncReservaContractTimestamps(supabase, contractId, 'generated')

    const leadId = await resolveContractLeadId(supabase, contractId)
    if (leadId) {
      await inngest.send({ name: 'contract.sent', data: { orgId: org.id, leadId, contractId } })
    }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao enviar para assinatura.' }
  }

  revalidatePath(`/app/${orgSlug}/contratos/${contractId}`)
  return { ok: true as const }
}

/** Consulta manual (botão "Verificar status") — o webhook (issue #16 §12)
 *  já atualiza automaticamente na maioria dos casos; isso é o fallback
 *  igual ao que Tráfego já usa hoje pra plan_contracts (que não tem
 *  webhook cobrindo ele). */
export async function refreshContractStatus(orgSlug: string, contractId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('contracts')
    .select('id, autentique_document_id, status')
    .eq('id', contractId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!contract?.autentique_document_id) return { ok: false as const, error: 'Contrato ainda não foi enviado para assinatura.' }

  const { data: signers } = await supabase.from('contract_signers').select('id, email').eq('contract_id', contractId)
  const { data: org2 } = await supabase.from('organizations').select('autentique_api_key').eq('id', org.id).maybeSingle()
  if (!org2?.autentique_api_key) return { ok: false as const, error: 'Chave da Autentique não configurada.' }

  try {
    const doc = await getAutentiqueDocumentStatus(org2.autentique_api_key, contract.autentique_document_id)
    const knownEmails = (signers || []).map(s => s.email).filter(Boolean) as string[]
    const signed = isDocumentSignedByKnownSigners(doc, knownEmails)

    if (signed && contract.status !== 'signed') {
      let signedObjectId: string | null = null
      const signedFileUrl = doc?.files?.signed || doc?.files?.pades
      if (signedFileUrl) {
        const res = await fetch(signedFileUrl)
        if (res.ok) {
          const arrBuf = await res.arrayBuffer()
          const upload = await StorageService.upload({
            organizationId: org.id,
            category: 'documents',
            scopeId: contractId,
            fileId: crypto.randomUUID(),
            body: Buffer.from(arrBuf),
            contentType: 'application/pdf',
            filename: 'contrato-assinado.pdf',
          })
          const { data: obj } = await supabase.from('storage_objects').insert({
            organization_id: org.id,
            storage_provider: upload.provider,
            bucket: upload.bucket,
            storage_key: upload.storageKey,
            filename: 'contrato-assinado.pdf',
            mime_type: 'application/pdf',
            size_bytes: arrBuf.byteLength,
          }).select('id').single()
          signedObjectId = obj?.id ?? null
        }
      }

      await supabase.from('contracts').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        ...(signedObjectId ? { signed_pdf_storage_object_id: signedObjectId } : {}),
      }).eq('id', contractId)
      await supabase.from('contract_signers').update({ status: 'signed', signed_at: new Date().toISOString() }).eq('contract_id', contractId)
      await supabase.from('contract_events').insert({ organization_id: org.id, contract_id: contractId, type: 'contract.signed' })
      const { syncReservaContractTimestamps } = await import('./contracts-origin')
      await syncReservaContractTimestamps(supabase, contractId, 'signed')

      const leadId = await resolveContractLeadId(supabase, contractId)
      if (leadId) {
        await inngest.send({ name: 'contract.signed', data: { orgId: org.id, leadId, contractId } })
      }
    }

    revalidatePath(`/app/${orgSlug}/contratos/${contractId}`)
    return { ok: true as const, signed }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Falha ao consultar status na Autentique.' }
  }
}

/** Reenvia o link de assinatura de UM signatário por e-mail (issue #60, B.5)
 *  — cada signatário tem seu próprio link salvo desde sendContractForSignature. */
export async function sendGlobalContractLinkByEmail(orgSlug: string, signerId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: signer } = await supabase
    .from('contract_signers').select('id, name, email, signature_link')
    .eq('id', signerId).eq('organization_id', org.id).maybeSingle()
  if (!signer) return { ok: false as const, error: 'Signatário não encontrado.' }
  if (!signer.signature_link) return { ok: false as const, error: 'Este signatário ainda não tem link — envie o contrato para assinatura primeiro.' }
  if (!signer.email) return { ok: false as const, error: `${signer.name} não tem e-mail cadastrado.` }

  try {
    await getResend().emails.send({
      from: clientEmailFrom(org.name),
      to: signer.email,
      subject: 'Contrato para assinatura',
      html: `<p>Olá, ${signer.name}! Segue o link para assinatura do seu contrato:</p><p><a href="${signer.signature_link}">${signer.signature_link}</a></p>`,
    })
    return { ok: true as const }
  } catch (e: any) {
    return { ok: false as const, error: e?.message || 'Erro ao enviar e-mail.' }
  }
}

/** Reenvia o link de assinatura de UM signatário por WhatsApp — só funciona
 *  se existir uma conversa desse contato na org (achada pelo telefone do
 *  signatário); sem isso, o botão fica desabilitado na UI com o motivo. */
export async function sendGlobalContractLinkByWhatsapp(orgSlug: string, signerId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: signer } = await supabase
    .from('contract_signers').select('id, name, phone, signature_link, contato_id')
    .eq('id', signerId).eq('organization_id', org.id).maybeSingle()
  if (!signer) return { ok: false as const, error: 'Signatário não encontrado.' }
  if (!signer.signature_link) return { ok: false as const, error: 'Este signatário ainda não tem link — envie o contrato para assinatura primeiro.' }

  const conversation = signer.contato_id
    ? await supabase.from('whatsapp_conversations').select('id')
      .eq('organization_id', org.id).eq('contato_id', signer.contato_id)
      .order('updated_at', { ascending: false }).limit(1).maybeSingle()
    : { data: null }
  if (!conversation.data) return { ok: false as const, error: 'Nenhuma conversa de WhatsApp encontrada com este signatário.' }

  const { sendWhatsappMessage } = await import('@/actions/whatsapp-messaging')
  const res = await sendWhatsappMessage(orgSlug, conversation.data.id, `Olá, ${signer.name}! Segue o link para assinatura do seu contrato: ${signer.signature_link}`)
  return res
}

/** Exclui um contrato que nunca foi enviado (issue #60, B.5) — decisão do
 *  usuário: contratos não expiram automaticamente, saem só por exclusão
 *  (rascunho) ou cancelamento (enviado). Assinado nunca pode ser excluído.
 *  contract_signers/contract_events têm FK on delete cascade. */
export async function deleteContract(orgSlug: string, contractId: string) {
  const { org, perm } = await requireContractsAccess(orgSlug)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: contract } = await supabase
    .from('contracts').select('id, status, autentique_document_id')
    .eq('id', contractId).eq('organization_id', org.id).maybeSingle()
  if (!contract) return { ok: false as const, error: 'Contrato não encontrado.' }
  if (contract.status !== 'draft' && contract.status !== 'ready') {
    return { ok: false as const, error: 'Só é possível excluir um contrato que ainda não foi enviado para assinatura.' }
  }
  if (contract.autentique_document_id) {
    return { ok: false as const, error: 'Este contrato já foi enviado — cancele em vez de excluir.' }
  }

  const { error } = await supabase.from('contracts').delete().eq('id', contractId)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/contratos`)
  return { ok: true as const }
}
