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
