'use server'

/**
 * Contract lifecycle (mark generated, attach signed voucher) and
 * traveler info lookup. Split out of actions/travel-sales.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'


/**
 * Alterna uma etapa do checklist da venda (Contratos Inteligentes).
 * "Contrato gerado" é setado por `markContractGenerated` (não por aqui);
 * as 4 restantes são marcáveis/desmarcáveis manualmente pelo usuário.
 */
/**
 * Marca "contrato gerado" na venda — idempotente (só seta na primeira
 * vez). Chamado pela rota de impressão do contrato ao carregar.
 */
export async function markContractGenerated(orgSlug: string, saleId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return
  const supabase = createClient()

  const { data: sale } = await supabase
    .from('travel_sales')
    .select('contrato_gerado_at')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return

  if (!(sale as any).contrato_gerado_at) {
    await supabase
      .from('travel_sales')
      .update({ contrato_gerado_at: new Date().toISOString() })
      .eq('id', saleId)
      .eq('organization_id', org.id)
  }
}

/**
 * Anexa o contrato assinado (upload manual — assinatura eletrônica real
 * fica pra uma leva futura) no mesmo array de vouchers/comprovantes já
 * exibido em Reservas.
 */
/** Dados do contato usados pra preencher um viajante da venda (nome, nascimento, CPF). */
export async function getContatoTravelerInfo(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }
  const supabase = createClient()
  const { data } = await supabase
    .from('contatos')
    .select('name, cpf, date_of_birth')
    .eq('organization_id', org.id)
    .eq('id', contatoId)
    .maybeSingle()
  if (!data) return { ok: false as const, error: 'Contato não encontrado.' }
  return {
    ok: true as const,
    data: {
      name: (data as any).name as string,
      cpf: ((data as any).cpf as string | null) ?? '',
      birth_date: ((data as any).date_of_birth as string | null) ?? '',
    },
  }
}

export async function attachSignedContract(orgSlug: string, saleId: string, voucher: { url: string; name: string }) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('vouchers')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const vouchers = [...(Array.isArray((sale as any).vouchers) ? (sale as any).vouchers : []), voucher]
  const { error } = await supabase
    .from('travel_sales')
    .update({ vouchers })
    .eq('id', saleId)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message || 'Erro ao anexar contrato assinado' }

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}
