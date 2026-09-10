'use server'

import { getActionContext } from '@/lib/services/context'
import { syncSaleRevenueEntryCore } from '@/lib/services/financial-sales-sync'


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
  return syncSaleRevenueEntryCore(await getActionContext(orgSlug), sale)
}
