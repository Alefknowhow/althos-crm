'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { checkMemberPermission } from '@/lib/permissions.server'
import { extractTravelDocumentFromFile, extractTravelDocumentFromFileGemini, type ExtractedTravelDocument } from '@/lib/ai/document-extract'
import { extractFinancialDocumentFromFile, extractFinancialDocumentFromFileGemini, type ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import { getPlatformAiKey, hasPlatformAiKey, getGeminiKey, hasGeminiKey } from '@/lib/ai/api-key'
import { consumeAiCredits } from '@/lib/plans/server'

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'] as const

/**
 * Extração de dados de um voucher/orçamento (PDF ou imagem) via visão do
 * Claude. Compartilhada pelo autopreenchimento de Reservas e pela nova aba
 * "Orçamento IA" em Cotações — cada tela mapeia o resultado pros seus
 * próprios campos.
 */
export async function extractTravelDocument(
  orgSlug: string,
  input: { base64: string; mediaType: string },
): Promise<{ ok: true; data: ExtractedTravelDocument } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  // Compartilhado pelo autopreenchimento de Reservas e pelo Orçamento IA em
  // Cotações — libera se o membro tiver acesso a QUALQUER um dos dois.
  const [permReservas, permCotacoes] = await Promise.all([
    checkMemberPermission(org.id, user.id, 'reservas'),
    checkMemberPermission(org.id, user.id, 'cotacoes'),
  ])
  if (!permReservas.allowed && !permCotacoes.allowed) {
    return { ok: false, error: permReservas.reason }
  }

  if (!input.base64) return { ok: false, error: 'Arquivo vazio.' }
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(input.mediaType)) {
    return { ok: false, error: 'Formato não suportado. Use PDF, JPG, PNG, WebP ou GIF.' }
  }

  const supabase = createClient()
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('ocr_provider')
    .eq('id', org.id)
    .maybeSingle()
  const provider = orgRow?.ocr_provider === 'gemini' ? 'gemini' : 'claude'

  if (provider === 'gemini' && !hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }
  if (provider === 'claude' && !hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  // Créditos: leitura de imagem/PDF por visão custa mais que uma chamada de
  // texto simples (ver lib/plans/config.ts AI_CREDIT_COST.ocr_extract).
  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'ocr_extract', metadata: { feature: 'document_extract', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  try {
    const data = provider === 'gemini'
      ? await extractTravelDocumentFromFileGemini(getGeminiKey(), input.base64, input.mediaType as any)
      : await extractTravelDocumentFromFile(getPlatformAiKey(), input.base64, input.mediaType as any)
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao processar o documento com IA.' }
  }
}

/**
 * "Ler com IA" no módulo Financeiro — extrai dados de nota fiscal/boleto/
 * recibo/comprovante ANTES do lançamento existir (o usuário ainda está no
 * formulário de criação), então não recebe entryId — só o arquivo. Depois
 * de criado o lançamento, o arquivo é enviado como anexo normalmente via
 * uploadFinancialAttachment.
 */
export async function extractFinancialDocument(
  orgSlug: string,
  input: { base64: string; mediaType: string },
): Promise<{ ok: true; data: ExtractedFinancialDocument } | { ok: false; error: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'financial')
  if (!perm.allowed) return { ok: false, error: perm.reason }

  if (!input.base64) return { ok: false, error: 'Arquivo vazio.' }
  if (!(ALLOWED_MEDIA_TYPES as readonly string[]).includes(input.mediaType)) {
    return { ok: false, error: 'Formato não suportado. Use PDF, JPG, PNG, WebP ou GIF.' }
  }

  const supabase = createClient()
  const { data: orgRow } = await supabase
    .from('organizations')
    .select('ocr_provider')
    .eq('id', org.id)
    .maybeSingle()
  const provider = orgRow?.ocr_provider === 'gemini' ? 'gemini' : 'claude'

  if (provider === 'gemini' && !hasGeminiKey()) return { ok: false, error: 'IA (Gemini) não configurada.' }
  if (provider === 'claude' && !hasPlatformAiKey()) return { ok: false, error: 'IA não configurada.' }

  const accountId = (org as any).account_id as string | null
  if (accountId) {
    const credit = await consumeAiCredits({ accountId, action: 'ocr_extract', metadata: { feature: 'financial_document_extract', orgSlug } })
    if (!credit.success) {
      return {
        ok: false,
        error: credit.error === 'insufficient_credits'
          ? 'Seus créditos de IA acabaram este mês. Faça upgrade ou aguarde a renovação.'
          : 'Não foi possível validar seus créditos de IA. Tente novamente.',
      }
    }
  }

  try {
    const data = provider === 'gemini'
      ? await extractFinancialDocumentFromFileGemini(getGeminiKey(), input.base64, input.mediaType as any)
      : await extractFinancialDocumentFromFile(getPlatformAiKey(), input.base64, input.mediaType as any)
    return { ok: true, data }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro ao processar o documento com IA.' }
  }
}
