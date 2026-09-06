/**
 * Shared helpers for the actions/contatos-*.ts modules (contatos.ts split
 * by concern -- see actions/contatos.ts for the barrel re-export). No
 * 'use server' directive here: these are plain helpers called from server
 * action files, not actions invoked directly from the client, and a
 * 'use server' file may only export async functions -- FROZEN_ERROR
 * wouldn't be legal there.
 */

import { checkMemberPermission } from '@/lib/permissions.server'

export const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

/**
 * Contatos serve tanto a tela de Pipeline (leads) quanto a de Contatos/
 * Clientes — libera se o membro tiver acesso a QUALQUER um dos módulos que
 * dependem desta tabela.
 */
export async function checkContatoPermission(orgId: string, userId: string) {
  const [pipeline, leads, clients] = await Promise.all([
    checkMemberPermission(orgId, userId, 'pipeline'),
    checkMemberPermission(orgId, userId, 'leads'),
    checkMemberPermission(orgId, userId, 'clients'),
  ])
  if (pipeline.allowed || leads.allowed || clients.allowed) return { allowed: true as const }
  return { allowed: false as const, reason: pipeline.reason }
}

function onlyDigits(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '')
}

/**
 * Bloqueia CPF/telefone duplicado dentro da mesma org — comparação por
 * dígitos (ignora formatação: "(11) 99999-9999" e "11999999999" contam como
 * o mesmo número), não string literal. `excludeId` evita falso positivo ao
 * salvar o próprio contato sem ter mudado o campo (ex.: editar CPF de um
 * lead que já tinha esse CPF salvo).
 *
 * Retorna a mensagem de erro pronta pra exibir, ou null se não há conflito.
 */
export async function checkContatoDuplicate(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createClient>,
  orgId: string,
  fields: { phone?: string | null; cpf?: string | null },
  excludeId?: string,
): Promise<string | null> {
  const phoneDigits = onlyDigits(fields.phone)
  const cpfDigits = onlyDigits(fields.cpf)
  if (!phoneDigits && !cpfDigits) return null

  if (phoneDigits) {
    let q = supabase.from('contatos').select('id, phone').eq('organization_id', orgId).not('phone', 'is', null)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q.limit(5000)
    if ((data || []).some((c: any) => onlyDigits(c.phone) === phoneDigits)) {
      return 'Já existe um contato com esse telefone.'
    }
  }

  if (cpfDigits) {
    let q = supabase.from('contatos').select('id, cpf').eq('organization_id', orgId).not('cpf', 'is', null)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q.limit(5000)
    if ((data || []).some((c: any) => onlyDigits(c.cpf) === cpfDigits)) {
      return 'Já existe um contato com esse CPF.'
    }
  }

  return null
}
