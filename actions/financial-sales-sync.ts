'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { nextOperatorPaymentDate, nextDecendioPaymentDate, nextSemanalPaymentDate } from '@/lib/financial/operator-payment'

/**
 * Sincroniza a receita de comissão de uma venda de viagem com Financeiro,
 * lançando o valor na PRÓXIMA data de pagamento da operadora (cadastrada em
 * Configurações > Operadoras) em vez do dia em que a venda foi fechada. Uma
 * venda sem operadora/comissão configurada simplesmente não gera lançamento.
 *
 * Comissão retida na fonte (ex.: cliente deu entrada à vista e a agência já
 * reteve parte da comissão nesse momento): quando `retained_commission_cents`
 * está preenchido, a venda gera DOIS lançamentos em vez de um —
 * 'retida' (vencimento = data da venda, D+0) e 'repasse' (o restante,
 * vencimento = data de pagamento da operadora). Se a retenção cobre a
 * comissão inteira, só o lançamento 'retida' é gerado. Sem retenção
 * (comportamento de sempre), um único lançamento sem `commission_role`
 * marcado — tratado como 'repasse' pra fins de idempotência.
 *
 * Idempotente: casa cada papel ('retida'/'repasse') com o lançamento já
 * vinculado à venda (venda_id) se a venda for salva de novo; nunca mexe num
 * lançamento já pago/cancelado; remove um papel que deixou de fazer sentido
 * (ex.: retenção removida) só se ele ainda estiver pendente/vencido.
 */
export async function syncSaleRevenueEntry(
  orgSlug: string,
  sale: {
    id: string; contato_id: string | null; client_name: string | null; operator: string | null
    commission_cents: number | null; retained_commission_cents: number | null; created_at: string
  },
) {
  if (!sale.operator?.trim() || !sale.commission_cents || sale.commission_cents <= 0) return

  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: opSetting } = await supabase
    .from('financial_settings')
    .select('payment_day, payment_schedule_type, payment_offset_days')
    .eq('organization_id', org.id)
    .eq('type', 'operadora')
    .ilike('name', sale.operator.trim())
    .maybeSingle()

  // Três formas de pagamento cadastráveis por operadora (Configurações >
  // Operadoras): dia fixo do mês, "decêndio" (paga X dias depois que o
  // bloco de 10 dias em que a venda caiu se fecha), ou "semanal" (corte a
  // cada 8 dias, vencimento fixo em 7 dias após o corte).
  let repasseDate: string | null = null
  if (opSetting?.payment_schedule_type === 'decendio' && opSetting.payment_offset_days != null) {
    repasseDate = nextDecendioPaymentDate(opSetting.payment_offset_days)
  } else if (opSetting?.payment_schedule_type === 'semanal') {
    repasseDate = nextSemanalPaymentDate()
  } else if (opSetting?.payment_day) {
    repasseDate = nextOperatorPaymentDate(opSetting.payment_day)
  }

  const total = sale.commission_cents
  const retained = Math.max(0, Math.min(sale.retained_commission_cents || 0, total))
  const repasse = total - retained
  const saleDate = sale.created_at.slice(0, 10)

  const plan: Array<{ role: 'retida' | 'repasse'; valor_cents: number; vencimento: string | null }> = []
  if (retained > 0) plan.push({ role: 'retida', valor_cents: retained, vencimento: saleDate })
  if (repasse > 0) plan.push({ role: 'repasse', valor_cents: repasse, vencimento: repasseDate })

  const { data: existing } = await supabase
    .from('financial_entries')
    .select('id, status, commission_role')
    .eq('organization_id', org.id)
    .eq('venda_id', sale.id)
    .eq('tipo', 'receita')

  // Lançamentos de antes dessa feature não têm commission_role — tratados
  // como 'repasse' (o único papel que existia até então).
  const existingByRole = new Map(
    (existing || []).map(e => [(e.commission_role as 'retida' | 'repasse' | null) || 'repasse', e]),
  )

  for (const item of plan) {
    const match = existingByRole.get(item.role)
    if (match) {
      existingByRole.delete(item.role)
      // Não mexe em lançamento já pago/cancelado — só mantém pendente em dia.
      if (match.status === 'pendente' || match.status === 'vencido') {
        await supabase
          .from('financial_entries')
          .update({ valor_cents: item.valor_cents, operadora: sale.operator, vencimento: item.vencimento })
          .eq('id', match.id)
      }
      continue
    }
    await supabase.from('financial_entries').insert({
      organization_id: org.id,
      tipo: 'receita',
      categoria: 'Comissão',
      valor_cents: item.valor_cents,
      competencia: new Date().toISOString().slice(0, 10),
      vencimento: item.vencimento,
      status: 'pendente',
      contato_id: sale.contato_id,
      venda_id: sale.id,
      operadora: sale.operator,
      commission_role: item.role,
      observacoes: item.role === 'retida'
        ? `Comissão retida na venda de ${sale.client_name || 'cliente'} (entrada à vista)`
        : `Comissão da venda de ${sale.client_name || 'cliente'}`,
      tags: [],
    })
  }

  // Papel que deixou de fazer sentido nesta venda (ex.: retenção removida
  // ou zerada) — só remove se ainda não foi pago/cancelado.
  for (const leftover of Array.from(existingByRole.values())) {
    if (leftover.status === 'pendente' || leftover.status === 'vencido') {
      await supabase.from('financial_entries').delete().eq('id', leftover.id)
    }
  }
}
