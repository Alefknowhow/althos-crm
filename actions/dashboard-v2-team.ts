/**
 * Dashboard v2 — performance individual (aba Equipe; Top vendedores da
 * Visão Geral). Uma única passada devolve TODAS as métricas por vendedor,
 * pra que o comparativo interativo troque de métrica no client sem refetch.
 *
 * Sem 'use server' (server-only). Toda query filtra `organization_id`.
 * A lista de membros vem do caller (listOrgMembers — já aplica a permissão
 * 'sales'), então aqui só se agregam números por `user_id`.
 */

import { createClient } from '@/lib/supabase/server'
import { fetchDetailedSales, getOrgMonthlyGoal } from './dashboard-v2-sales'

const DAY = 86_400_000

export type SellerPerf = {
  seller_id: string
  name: string
  revenue_cents: number
  sales_count: number
  commission_cents: number
  ticket_cents: number
  leads: number
  won: number
  conversion_pct: number | null
  /** Receita do mês calendário corrente (base da % de meta). */
  month_revenue_cents: number
  goal_cents: number | null
  goal_is_individual: boolean
  goal_pct: number | null
  avg_cycle_days: number | null
  open_deals: number
  open_value_cents: number
  /** % das oportunidades abertas com alguma interação nos últimos 7 dias. */
  followup_pct: number | null
  avg_response_min: number | null
  response_rate_pct: number | null
}

type Member = { id: string; name: string }

async function responseBySeller(orgId: string, since: Date, sellerFilter: string | null) {
  const supabase = createClient()
  let cq = supabase
    .from('whatsapp_conversations')
    .select('id, assigned_to')
    .eq('organization_id', orgId)
    .not('assigned_to', 'is', null)
    .gte('last_message_at', since.toISOString())
    .limit(5000)
  if (sellerFilter) cq = cq.eq('assigned_to', sellerFilter)
  const { data: convs } = await cq
  const ownerByConv = new Map(((convs || []) as any[]).map(c => [c.id as string, c.assigned_to as string]))
  const out = new Map<string, { minutes: number[]; inbound: number; answered: number }>()
  const convIds = Array.from(ownerByConv.keys())
  for (let i = 0; i < convIds.length; i += 200) {
    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('conversation_id, direction, created_at')
      .eq('organization_id', orgId)
      .in('conversation_id', convIds.slice(i, i + 200))
      .gte('created_at', since.toISOString())
      .order('conversation_id', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(20000)
    const byConv = new Map<string, { direction: string; created_at: string }[]>()
    for (const m of (msgs || []) as any[]) {
      const l = byConv.get(m.conversation_id) || []
      l.push(m)
      byConv.set(m.conversation_id, l)
    }
    for (const [convId, list] of Array.from(byConv.entries())) {
      const owner = ownerByConv.get(convId)!
      const acc = out.get(owner) || { minutes: [], inbound: 0, answered: 0 }
      for (let k = 0; k < list.length; k++) {
        if (list[k].direction !== 'inbound') continue
        // Só a primeira inbound de uma sequência conta (várias mensagens seguidas do cliente = 1 espera).
        if (k > 0 && list[k - 1].direction === 'inbound') continue
        acc.inbound++
        const next = list.slice(k + 1).find(m => m.direction === 'outbound')
        if (next) {
          acc.answered++
          acc.minutes.push((new Date(next.created_at).getTime() - new Date(list[k].created_at).getTime()) / 60_000)
        }
      }
      out.set(owner, acc)
    }
  }
  return out
}

export async function getTeamPerformance(
  orgId: string,
  members: Member[],
  opts: { since: Date; sellerId?: string | null },
): Promise<SellerPerf[]> {
  const supabase = createClient()
  const sellerId = opts.sellerId ?? null
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  let leadsQ = supabase.from('contatos').select('assigned_to, deal_status').eq('organization_id', orgId)
    .not('assigned_to', 'is', null).gte('created_at', opts.since.toISOString()).limit(20000)
  let wonQ = supabase.from('contatos').select('assigned_to, created_at, closed_at').eq('organization_id', orgId)
    .eq('deal_status', 'ganho').not('assigned_to', 'is', null).gte('closed_at', opts.since.toISOString()).limit(20000)
  let openQ = supabase.from('contatos').select('assigned_to, value_cents, last_activity_at').eq('organization_id', orgId)
    .eq('deal_status', 'aberto').not('assigned_to', 'is', null).limit(20000)
  if (sellerId) {
    leadsQ = leadsQ.eq('assigned_to', sellerId)
    wonQ = wonQ.eq('assigned_to', sellerId)
    openQ = openQ.eq('assigned_to', sellerId)
  }

  const [sales, monthSales, { data: leads }, { data: won }, { data: open }, { data: goals }, companyGoal, response] = await Promise.all([
    fetchDetailedSales(orgId, { since: opts.since, sellerId }),
    fetchDetailedSales(orgId, { since: monthStart, sellerId }),
    leadsQ,
    wonQ,
    openQ,
    supabase.from('memberships').select('user_id, monthly_goal_cents').eq('organization_id', orgId),
    getOrgMonthlyGoal(orgId),
    responseBySeller(orgId, opts.since, sellerId),
  ])

  type Acc = Omit<SellerPerf, 'name' | 'ticket_cents' | 'conversion_pct' | 'goal_cents' | 'goal_is_individual' | 'goal_pct' | 'avg_cycle_days' | 'followup_pct' | 'avg_response_min' | 'response_rate_pct'> & { cycles: number[]; recent: number }
  const acc = new Map<string, Acc>()
  const get = (id: string): Acc => {
    let a = acc.get(id)
    if (!a) {
      a = { seller_id: id, revenue_cents: 0, sales_count: 0, commission_cents: 0, leads: 0, won: 0, month_revenue_cents: 0, open_deals: 0, open_value_cents: 0, cycles: [], recent: 0 }
      acc.set(id, a)
    }
    return a
  }

  for (const s of sales) if (s.seller_id) { const a = get(s.seller_id); a.revenue_cents += s.amount_cents; a.sales_count += 1; a.commission_cents += s.commission_cents }
  for (const s of monthSales) if (s.seller_id) get(s.seller_id).month_revenue_cents += s.amount_cents
  for (const l of (leads || []) as any[]) { const a = get(l.assigned_to); a.leads += 1; if (l.deal_status === 'ganho') a.won += 1 }
  for (const w of (won || []) as any[]) {
    const d = (new Date(w.closed_at).getTime() - new Date(w.created_at).getTime()) / DAY
    if (d >= 0) get(w.assigned_to).cycles.push(d)
  }
  const weekAgo = Date.now() - 7 * DAY
  for (const o of (open || []) as any[]) {
    const a = get(o.assigned_to)
    a.open_deals += 1
    a.open_value_cents += o.value_cents || 0
    if (o.last_activity_at && new Date(o.last_activity_at).getTime() >= weekAgo) a.recent += 1
  }
  for (const id of Array.from(response.keys())) get(id)

  const memberIds = new Set(members.map(m => m.id))
  const nameById = new Map(members.map(m => [m.id, m.name]))
  // Só membros atuais da org (evita vazar ids de ex-membros como linhas órfãs).
  const active = Array.from(acc.values()).filter(a => memberIds.has(a.seller_id))
  const individualGoal = new Map(((goals || []) as any[]).map(g => [g.user_id as string, g.monthly_goal_cents as number | null]))
  const activeCount = Math.max(1, active.length)
  const fallbackGoal = companyGoal ? Math.round(companyGoal / activeCount) : null

  return active
    .map(a => {
      const ind = individualGoal.get(a.seller_id) ?? null
      const goal = ind ?? fallbackGoal
      const r = response.get(a.seller_id)
      const { cycles, recent, ...rest } = a
      return {
        ...rest,
        name: nameById.get(a.seller_id) || 'Usuário',
        ticket_cents: a.sales_count > 0 ? Math.round(a.revenue_cents / a.sales_count) : 0,
        conversion_pct: a.leads > 0 ? (a.won / a.leads) * 100 : null,
        goal_cents: goal,
        goal_is_individual: ind !== null,
        goal_pct: goal && goal > 0 ? (a.month_revenue_cents / goal) * 100 : null,
        avg_cycle_days: cycles.length > 0 ? cycles.reduce((x, y) => x + y, 0) / cycles.length : null,
        followup_pct: a.open_deals > 0 ? (recent / a.open_deals) * 100 : null,
        avg_response_min: r && r.minutes.length > 0 ? r.minutes.reduce((x, y) => x + y, 0) / r.minutes.length : null,
        response_rate_pct: r && r.inbound > 0 ? (r.answered / r.inbound) * 100 : null,
      }
    })
    .sort((x, y) => y.revenue_cents - x.revenue_cents)
}

/* ------------------------------------------------------------------ */

export type ScoreComponent = { key: string; label: string; score: number | null; detail: string }

function avg(xs: (number | null)[]): number | null {
  const v = xs.filter((x): x is number => x !== null && Number.isFinite(x))
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null
}

/**
 * Composição do score de performance (0-100 por critério), para o time
 * inteiro (média) ou para o vendedor selecionado. Critérios:
 *   Conversão     = conversão ÷ melhor conversão do time × 100
 *   Meta          = % da meta do mês atingida (teto 100)
 *   Tempo resposta= 100 até 5 min, cai linearmente até 0 em 4h
 *   Follow-up     = % de oportunidades abertas com interação nos últimos 7 dias
 *   Ciclo         = menor ciclo do time ÷ ciclo × 100
 */
export function buildScoreComposition(all: SellerPerf[], focus: SellerPerf[]): ScoreComponent[] {
  const bestConv = Math.max(0, ...all.map(s => s.conversion_pct ?? 0))
  const cycles = all.map(s => s.avg_cycle_days).filter((c): c is number => c !== null && c > 0)
  const bestCycle = cycles.length > 0 ? Math.min(...cycles) : null

  const conv = avg(focus.map(s => s.conversion_pct))
  const meta = avg(focus.map(s => s.goal_pct))
  const resp = avg(focus.map(s => s.avg_response_min))
  const fu = avg(focus.map(s => s.followup_pct))
  const cyc = avg(focus.map(s => s.avg_cycle_days))
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

  return [
    { key: 'conv', label: 'Conversão', score: conv !== null && bestConv > 0 ? clamp((conv / bestConv) * 100) : null, detail: conv !== null ? `${conv.toFixed(1)}% (melhor do time: ${bestConv.toFixed(1)}%)` : 'Sem leads atribuídos' },
    { key: 'meta', label: 'Meta', score: meta !== null ? clamp(meta) : null, detail: meta !== null ? `${Math.round(meta)}% da meta do mês` : 'Sem meta configurada' },
    { key: 'resp', label: 'Tempo de resposta', score: resp !== null ? clamp(100 - ((resp - 5) / (240 - 5)) * 100) : null, detail: resp !== null ? `${Math.round(resp)} min em média` : 'Sem conversas atribuídas' },
    { key: 'fu', label: 'Follow-up', score: fu !== null ? clamp(fu) : null, detail: fu !== null ? `${Math.round(fu)}% das abertas com interação em 7 dias` : 'Sem oportunidades abertas' },
    { key: 'cycle', label: 'Ciclo', score: cyc !== null && bestCycle ? clamp((bestCycle / Math.max(cyc, 0.1)) * 100) : null, detail: cyc !== null ? `${cyc.toFixed(1)} dias até fechar` : 'Sem vendas fechadas' },
  ]
}
