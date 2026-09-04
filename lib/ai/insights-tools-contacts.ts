/**
 * AI Analyst tools -- contact/lead lookups and appointment listings.
 * Split out of insights-tools.ts.
 */

import type { AnalyticsContext, AnalyticsResult } from './insights-tools-definitions'
import { fmtCurrency } from './insights-tools-helpers'

export function formatAddress(r: { street?: string | null; number?: string | null; district?: string | null; city?: string | null; state?: string | null }): string {
  const line1 = [r.street, r.number].filter(Boolean).join(', ')
  const line2 = [r.district, r.city, r.state].filter(Boolean).join(' - ')
  return [line1, line2].filter(Boolean).join(' — ') || '—'
}

/**
 * Busca detalhada de contatos — a IA precisa conseguir ENTREGAR uma lista
 * completa (nome/telefone/e-mail/endereço), não só contagens/rankings
 * limitados como consultar_top_leads. Sem isso, pedidos do tipo "quais
 * clientes moram em Itajaí" batiam num beco sem saída (nenhuma tool cobria
 * filtro geográfico + retorno de lista completa).
 */
export async function queryContacts(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const limite = Math.min(100, Math.max(1, Number(input.limite) || 30))

  let q = ctx.supabase
    .from('contatos')
    .select('name, phone, email, city, state, street, number, district, status, value_cents, tags')
    .eq('organization_id', ctx.orgId)
    .order('name')
    .limit(limite)

  if (input.cidade) q = q.ilike('city', `%${input.cidade}%`)
  if (input.estado) q = q.ilike('state', `%${input.estado}%`)
  if (input.status) q = q.eq('status', input.status)
  if (input.tag) q = q.contains('tags', [input.tag])
  if (input.valor_minimo) q = q.gte('value_cents', Math.round(Number(input.valor_minimo) * 100))
  if (input.busca) q = q.or(`name.ilike.%${input.busca}%,email.ilike.%${input.busca}%,phone.ilike.%${input.busca}%`)

  const { data, error } = await q
  if (error) return { summary: `Erro ao buscar contatos: ${error.message}`, view: { type: 'none' } }

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: 'Nenhum contato encontrado com esses filtros.', view: { type: 'none' } }
  }

  return {
    summary: `${rows.length} contato(s) encontrado(s)${input.cidade ? ` em "${input.cidade}"` : ''}${input.status ? `, status ${input.status}` : ''}. Lista completa na tabela — nome, telefone, e-mail e endereço de cada um.`,
    view: {
      type: 'table',
      columns: ['Nome', 'Telefone', 'E-mail', 'Endereço', 'Status', 'Valor'],
      rows: rows.map(r => [
        r.name || '—',
        r.phone || '—',
        r.email || '—',
        formatAddress(r),
        r.status || '—',
        r.value_cents ? fmtCurrency(r.value_cents) : '—',
      ]),
    },
  }
}

/**
 * Lista agendamentos individuais (cliente, serviço, profissional quando
 * aplicável, data/hora, status) — consultar_agendamentos só dá contagem por
 * status, não serve pra "quais são os agendamentos de amanhã".
 */
export async function queryAppointmentsDetailed(input: Record<string, any>, ctx: AnalyticsContext): Promise<AnalyticsResult> {
  const direction = input.direcao === 'passados' ? 'passados' : 'futuros'
  const dias = Math.min(90, Math.max(1, Number(input.dias) || 14))
  const limite = Math.min(100, Math.max(1, Number(input.limite) || 30))
  const now = new Date()
  const edge = new Date(now)
  edge.setDate(edge.getDate() + (direction === 'futuros' ? dias : -dias))

  let q = ctx.supabase
    .from('appointments')
    .select('start_time, status, guest_name, contato_id, contatos(name), event_types(name)')
    .eq('organization_id', ctx.orgId)
    .neq('status', 'canceled')

  if (direction === 'futuros') {
    q = q.gte('start_time', now.toISOString()).lte('start_time', edge.toISOString()).order('start_time', { ascending: true })
  } else {
    q = q.gte('start_time', edge.toISOString()).lte('start_time', now.toISOString()).order('start_time', { ascending: false })
  }
  if (input.status) q = q.eq('status', input.status)
  q = q.limit(limite)

  const { data, error } = await q
  if (error) return { summary: `Erro ao buscar agendamentos: ${error.message}`, view: { type: 'none' } }

  const rows = (data as any[]) || []
  if (rows.length === 0) {
    return { summary: `Nenhum agendamento ${direction} encontrado nos próximos/últimos ${dias} dias.`, view: { type: 'none' } }
  }

  return {
    summary: `${rows.length} agendamento(s) ${direction} encontrados (janela de ${dias} dias). O mais próximo: ${rows[0].contatos?.name || rows[0].guest_name || 'sem cliente'}, ${rows[0].event_types?.name || 'sem serviço definido'}, em ${new Date(rows[0].start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}.`,
    view: {
      type: 'table',
      columns: ['Cliente', 'Serviço', 'Data/Hora', 'Status'],
      rows: rows.map(r => [
        r.contatos?.name || r.guest_name || '—',
        r.event_types?.name || '—',
        new Date(r.start_time).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }),
        r.status || '—',
      ]),
    },
  }
}

export async function queryTopLeads(
  input: Record<string, any>,
  ctx: AnalyticsContext,
): Promise<AnalyticsResult> {
  const criterio = (input.criterio || 'recente') as string
  const n = Math.min(20, Math.max(1, Number(input.n) || 10))

  let q = ctx.supabase
    .from('contatos')
    .select('id, name, email, phone, value_cents, ai_score, ai_tier, source, updated_at, created_at')
    .eq('organization_id', ctx.orgId)
    .limit(n)

  switch (criterio) {
    case 'score':
      q = q.not('ai_score', 'is', null).order('ai_score', { ascending: false })
      break
    case 'valor':
      q = q.gt('value_cents', 0).order('value_cents', { ascending: false })
      break
    case 'sem_contato':
      q = q.order('updated_at', { ascending: true })
      break
    case 'recente':
    default:
      q = q.order('created_at', { ascending: false })
      break
  }

  const { data } = await q
  if (!data || data.length === 0) {
    return { summary: 'Nenhum lead encontrado.', view: { type: 'none' } }
  }

  return {
    summary: `Top ${data.length} leads por critério "${criterio}".`,
    view: {
      type: 'table',
      columns: ['Nome', 'Contato', 'Score', 'Valor', 'Origem'],
      rows: data.map(l => [
        l.name || '—',
        l.email || l.phone || '—',
        l.ai_score != null ? `${l.ai_score} (${l.ai_tier || ''})` : '—',
        l.value_cents ? fmtCurrency(l.value_cents) : '—',
        l.source || '—',
      ]),
    },
  }
}

