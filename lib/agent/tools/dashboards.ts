import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { define, date, requireModule } from './crm-shared'
import type { AgentContext } from '@/lib/agent/context'

export function summarizeFinance(rows: Record<string, any>[]) {
  const active = rows.filter(row => row.status !== 'cancelado')
  const sum = (type: string, paidOnly = false) => active.filter(row => row.tipo === type && (!paidOnly || row.status === 'pago')).reduce((total, row) => total + Number(row.valor_cents || 0), 0)
  const byCategory: Record<string, { receita_cents: number; despesa_cents: number }> = Object.create(null)
  for (const row of active) {
    const category = byCategory[row.categoria] ??= { receita_cents: 0, despesa_cents: 0 }
    if (row.tipo === 'receita') category.receita_cents += Number(row.valor_cents || 0)
    if (row.tipo === 'despesa') category.despesa_cents += Number(row.valor_cents || 0)
  }
  return { receita_cents: sum('receita'), despesa_cents: sum('despesa'), resultado_cents: sum('receita') - sum('despesa'), recebidos_cents: sum('receita', true), pagos_cents: sum('despesa', true), categories: byCategory, entries: active.length }
}

async function rows(ctx: AgentContext, table: string, columns: string, field: string, start: string, end: string) {
  const all: Record<string, any>[] = []
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await createAdminClient().from(table).select(columns).eq('organization_id', ctx.orgId)
      .gte(field, start).lte(field, field === 'competencia' ? end : `${end}T23:59:59.999Z`).order('id').range(offset, offset + 999)
    if (error) throw new Error(error.message)
    all.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return all
  }
  throw new Error('Período excede 50 mil registros. Reduza o intervalo; nenhum total parcial foi retornado.')
}

export const dashboardTools = [define('get_dashboard_data', 'Consulta indicadores para insights nas dashboards de pipeline, reservas ou financeiro. Período inclusivo, datas UTC e valores em centavos. Financeiro usa competência, excluindo cancelados; pipeline usa criação e fechamento; reservas usa criação. Retorna a base de cálculo para evitar comparar métricas incompatíveis.',
  null, { module: z.enum(['pipeline', 'reservations', 'financial']), startDate: date, endDate: date }, 'read', async (ctx, input) => {
    if (input.endDate < input.startDate) throw new Error('Fim anterior ao início.')
    const { startDate: start, endDate: end } = input
    const meta = { period: { start, end, timezone: 'UTC' }, currencyUnit: 'centavos', generatedAt: new Date().toISOString() }
    if (input.module === 'financial') {
      requireModule(ctx, 'financial')
      const entries = await rows(ctx, 'financial_entries', 'id,tipo,categoria,valor_cents,status,competencia', 'competencia', start, end)
      return { ...meta, basis: 'competencia; cancelados excluídos; recebidos/pagos são o subconjunto pago da mesma competência, não fluxo por data de pagamento', ...summarizeFinance(entries) }
    }
    if (input.module === 'reservations') {
      requireModule(ctx, 'reservas')
      const sales = await rows(ctx, 'travel_sales', 'id,status,total_cents,commission_cents,destination', 'created_at', start, end)
      const active = sales.filter(row => !['cancelled', 'canceled'].includes(row.status))
      return { ...meta, basis: 'reservas criadas no período, canceladas excluídas dos valores', count: sales.length, activeCount: active.length, cancelledCount: sales.length - active.length,
        total_cents: active.reduce((s, r) => s + Number(r.total_cents || 0), 0), commission_cents: active.reduce((s, r) => s + Number(r.commission_cents || 0), 0) }
    }
    requireModule(ctx, 'pipeline')
    const [created, closed] = await Promise.all([
      rows(ctx, 'contatos', 'id,source,stage_id', 'created_at', start, end),
      rows(ctx, 'contatos', 'id,deal_status,value_cents', 'closed_at', start, end),
    ])
    const won = closed.filter(row => row.deal_status === 'ganho')
    const sources: Record<string, number> = Object.create(null)
    for (const row of created) sources[row.source || 'não informado'] = (sources[row.source || 'não informado'] ?? 0) + 1
    return { ...meta, basis: 'novos contatos por created_at; ganhos/perdidos por closed_at, sem tratar as duas populações como uma coorte', newContacts: created.length, won: won.length,
      lost: closed.filter(row => ['perdido', 'desqualificado'].includes(row.deal_status)).length, won_value_cents: won.reduce((s, r) => s + Number(r.value_cents || 0), 0), sources }
  })]
