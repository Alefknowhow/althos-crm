'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isTravelNiche } from '@/lib/niche'
import { revalidatePath } from 'next/cache'

export type TravelSaleRow = {
  id: string
  sale_number: string
  organization_id: string
  contato_id: string | null
  proposal_id: string | null
  created_by: string | null
  status: string
  client_name: string | null
  destination: string | null
  departure_date: string | null
  return_date: string | null
  negotiation_days: number | null
  total_cents: number
  hotel_name: string | null
  airline: string | null
  operator: string | null
  services: any[]
  included_items: string[]
  vouchers: any[]
  travelers: any[]
  travelers_note: string | null
  payment_method: string | null
  package_locator: string | null
  air_locator: string | null
  hotel_locator: string | null
  airline_checkin_url: string | null
  commission_cents: number
  /** Parte da comissão retida na fonte (ex.: entrada à vista) — lançada em
   * Financeiro na data da venda, em vez de esperar o repasse da operadora. */
  retained_commission_cents: number | null
  notes: string | null
  tasks_generated_at: string | null
  contrato_gerado_at: string | null
  contrato_assinado_at: string | null
  voucher_entregue_at: string | null
  embarque_realizado_at: string | null
  posvenda_concluido_at: string | null
  cancellation_policy: string | null
  important_info: string | null
  service_info: string | null
  flights: FlightSegment[]
  created_at: string
  updated_at: string
}

export type FlightSegment = {
  companhia?: string | null
  numero?: string | null
  data?: string | null
  origem?: string | null
  destino?: string | null
  horario?: string | null
  sentido?: 'ida' | 'volta' | null
}

const WRITABLE = [
  'status', 'client_name', 'destination', 'departure_date', 'return_date',
  'negotiation_days', 'total_cents', 'hotel_name', 'airline', 'operator', 'services',
  'included_items', 'vouchers', 'travelers', 'travelers_note',
  'payment_method', 'package_locator', 'air_locator', 'hotel_locator', 'airline_checkin_url',
  'commission_cents', 'retained_commission_cents', 'notes', 'cancellation_policy', 'important_info', 'service_info', 'flights',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
  // Nunca deixa reter mais do que a comissão total — trava aqui pra não
  // depender só da checagem no client.
  if ('retained_commission_cents' in out) {
    const total = 'commission_cents' in out ? Number(out.commission_cents) : Number(input.commission_cents ?? 0)
    const r = out.retained_commission_cents
    out.retained_commission_cents = r == null || r === '' ? null : Math.max(0, Math.min(Math.round(Number(r) || 0), Math.round(total) || 0))
  }
  for (const k of ['total_cents', 'commission_cents', 'negotiation_days'] as const) {
    if (k in out && out[k] != null && out[k] !== '') {
      const n = Number(out[k])
      out[k] = Number.isFinite(n) ? Math.round(n) : 0
    } else if (k in out) {
      out[k] = null
    }
  }
  for (const k of ['departure_date', 'return_date'] as const) {
    if (k in out && !out[k]) out[k] = null
  }
  return out
}

/** Nomes de operadora cadastrados em Financeiro (Configurações > Operadoras)
 *  pro <Select> de Operadora na venda — gated por 'reservas' (não 'financial')
 *  pra não bloquear agentes que não têm acesso ao módulo financeiro. */
export async function listSaleOperatorOptions(orgSlug: string): Promise<string[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('financial_settings')
    .select('name')
    .eq('organization_id', org.id)
    .eq('type', 'operadora')
    .order('name', { ascending: true })
  return (data ?? []).map((r: any) => r.name as string)
}

export async function listTravelSales(orgSlug: string): Promise<TravelSaleRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })
    .limit(500)
  return (data as TravelSaleRow[]) ?? []
}

export async function getTravelSale(orgSlug: string, id: string): Promise<TravelSaleRow | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return null
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', id)
    .maybeSingle()
  return (data as TravelSaleRow) ?? null
}

export async function updateTravelSale(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_sales')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao salvar venda' }
  const s = data as TravelSaleRow

  // Mesmo sync de saveTravelSaleAndGenerateTasks — precisa acontecer em
  // QUALQUER salvamento (não só ao gerar tarefas), senão editar comissão/
  // retenção pelo botão "Salvar" simples nunca refletia no Financeiro.
  const { syncSaleRevenueEntry } = await import('@/actions/financial')
  await syncSaleRevenueEntry(orgSlug, {
    id: s.id, contato_id: s.contato_id, client_name: s.client_name,
    operator: s.operator, commission_cents: s.commission_cents ?? null,
    retained_commission_cents: s.retained_commission_cents ?? null,
    created_at: s.created_at,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: s }
}

export async function deleteTravelSale(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('travel_sales')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir venda' }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}

/**
 * Cancela a reserva e gera o crédito de viagem correspondente na mesma
 * operação — cancelamento sem crédito não é uma opção neste fluxo, pois a
 * operadora sempre retém o valor como crédito futuro (não devolve em
 * dinheiro). Os 4 campos são obrigatórios.
 */
export async function cancelTravelSale(
  orgSlug: string,
  saleId: string,
  input: { valorCredito: number; operadora: string; validade?: string | null; observacoes?: string | null },
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!input.valorCredito || input.valorCredito <= 0) {
    return { ok: false as const, error: 'Informe o valor do crédito gerado pela operadora.' }
  }
  if (!input.operadora?.trim()) {
    return { ok: false as const, error: 'Informe a operadora responsável pelo crédito.' }
  }

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('*')
    .eq('organization_id', org.id)
    .eq('id', saleId)
    .maybeSingle()

  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }
  if (!(sale as TravelSaleRow).contato_id) {
    return { ok: false as const, error: 'Esta venda não está vinculada a um contato — não é possível gerar o crédito.' }
  }

  const { data: updated, error } = await supabase
    .from('travel_sales')
    .update({ status: 'cancelled' })
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !updated) return { ok: false as const, error: error?.message || 'Erro ao cancelar venda' }

  const { createCredit } = await import('@/actions/travel-credits')
  const creditResult = await createCredit(orgSlug, {
    contatoId: (sale as TravelSaleRow).contato_id as string,
    valorCents: Math.round(input.valorCredito),
    operadora: input.operadora,
    validade: input.validade,
    observacoes: input.observacoes,
    origemSaleId: saleId,
  })

  if (!creditResult.ok) {
    return { ok: false as const, error: `Venda cancelada, mas falhou ao gerar o crédito: ${creditResult.error}` }
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: updated as TravelSaleRow, credit: creditResult.data }
}

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

// ── helpers ─────────────────────────────────────────────────────────────────

/**
 * Map a proposal row into the pre-fillable fields of a travel sale.
 * Shared by the auto-creation-on-won path and the manual "Nova venda" flow.
 */
function mapProposalToSaleFields(proposal: any): Record<string, any> {
  const destination = (proposal.destinations || [])
    .map((d: any) => d?.name).filter(Boolean).join(', ') || null
  const hotelName = (proposal.hotels || [])
    .map((h: any) => h?.name).filter(Boolean).join(', ') || null
  const airlines = Array.from(new Set((proposal.flights || [])
    .map((f: any) => f?.airline).filter(Boolean)))
  const airline = airlines.length ? airlines.join(', ') : null
  const services = Object.entries(proposal.services || {})
    .filter(([, v]: any) => v?.enabled)
    .map(([k]) => k)
  const methods: string[] = proposal.payment?.methods || []

  let negotiationDays: number | null = null
  if (proposal.created_at) {
    const ms = Date.now() - new Date(proposal.created_at).getTime()
    negotiationDays = Math.max(0, Math.round(ms / 86400000))
  }

  return {
    client_name: proposal.client_name,
    destination,
    departure_date: proposal.start_date,
    return_date: proposal.end_date,
    negotiation_days: negotiationDays,
    total_cents: proposal.total_cents || 0,
    hotel_name: hotelName,
    airline,
    services,
    payment_method: methods.join(', ') || null,
    travelers: Array.isArray(proposal.travelers) ? proposal.travelers : [],
    travelers_note: proposal.travelers_note ?? null,
  }
}

/**
 * Manually create a travel sale, optionally pre-filled from a proposal.
 * Powers the "Nova venda" button — a robust fallback to the auto-creation
 * that fires when a lead is moved to a won stage.
 *
 * `contatoId` is mandatory: toda venda precisa estar ligada a um lead/contato
 * do CRM, para que o vendedor não consiga registrar um cliente que não foi
 * cadastrado. O nome do cliente da venda vem sempre do contato vinculado.
 */
export async function createTravelSale(orgSlug: string, proposalId: string | null | undefined, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  if (!contatoId) {
    return { ok: false as const, error: 'Selecione o cliente (contato do CRM) para criar a venda.' }
  }

  const supabase = createClient()

  const { data: contato } = await supabase
    .from('contatos')
    .select('id, name')
    .eq('organization_id', org.id)
    .eq('id', contatoId)
    .maybeSingle()
  if (!contato) return { ok: false as const, error: 'Contato não encontrado.' }

  let prefill: Record<string, any> = {}
  let linkedProposalId: string | null = null

  if (proposalId) {
    const { data: proposal } = await supabase
      .from('travel_proposals')
      .select('*')
      .eq('organization_id', org.id)
      .eq('id', proposalId)
      .maybeSingle()
    if (!proposal) return { ok: false as const, error: 'Proposta não encontrada.' }
    prefill = mapProposalToSaleFields(proposal)
    linkedProposalId = (proposal as any).id
  }

  const { data, error } = await supabase
    .from('travel_sales')
    .insert({
      organization_id: org.id,
      contato_id: contato.id,
      proposal_id: linkedProposalId,
      created_by: user.id,
      status: 'open',
      ...prefill,
      client_name: (contato as any).name || prefill.client_name || null,
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar venda' }

  // In-app notification (org-wide) so the team sees the new sale in the bell.
  const { createNotification } = await import('@/actions/notifications')
  const clientName = (data as TravelSaleRow).client_name
  await createNotification({
    organizationId: org.id,
    type: 'new_sale',
    title: 'Nova venda viagem criada',
    content: clientName ? `Venda iniciada para ${clientName}.` : 'Uma nova venda viagem foi iniciada.',
    link: `/app/${orgSlug}/reservas`,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: data as TravelSaleRow }
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString()
}

/**
 * Save the sale and (idempotently) generate the operational checklist tasks:
 *  - Check-in do voo (ida)  → 1 dia antes da partida
 *  - Check-in do voo (volta)→ 1 dia antes do retorno
 *  - Contatar hotel + e-mail→ 5 dias antes da partida
 *  - Enviar briefing cliente→ 5 dias antes da partida
 */
export async function saveTravelSaleAndGenerateTasks(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: sale, error } = await supabase
    .from('travel_sales')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !sale) return { ok: false as const, error: error?.message || 'Erro ao salvar venda' }
  const s = sale as TravelSaleRow

  // Lança/atualiza a receita de comissão em Financeiro na data de pagamento
  // da operadora (não no dia da venda) — sem operadora/comissão, não faz nada.
  const { syncSaleRevenueEntry } = await import('@/actions/financial')
  await syncSaleRevenueEntry(orgSlug, {
    id: s.id, contato_id: s.contato_id, client_name: s.client_name,
    operator: s.operator, commission_cents: s.commission_cents ?? null,
    retained_commission_cents: s.retained_commission_cents ?? null,
    created_at: s.created_at,
  })

  if (s.tasks_generated_at) {
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, data: s, tasksCreated: 0, alreadyGenerated: true }
  }

  // Vendas com produtos estruturados geram tarefas pela tela de "Tarefas
  // sugeridas" (por produto, ver lib/reservas/task-templates.ts) em vez do
  // checklist flat abaixo — que fica só como fallback pra vendas legadas
  // sem nenhum sale_product.
  const { count: productCount } = await supabase
    .from('sale_products')
    .select('id', { count: 'exact', head: true })
    .eq('sale_id', id)
  if ((productCount || 0) > 0) {
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, data: s, tasksCreated: 0, alreadyGenerated: false, hasProducts: true }
  }

  const client = s.client_name || 'cliente'
  const tasks: { title: string; description: string; due_date: string; priority: string }[] = []

  if (s.departure_date) {
    const checkinInfo = [
      s.air_locator ? `Localizador aéreo: ${s.air_locator}` : null,
      s.airline ? `Cia aérea: ${s.airline}` : null,
    ].filter(Boolean).join('\n')

    tasks.push({
      title: `✈️ Check-in do voo (ida) — ${client}`,
      description: checkinInfo || 'Realizar check-in do voo de ida.',
      due_date: shiftDate(s.departure_date, -1),
      priority: 'high',
    })
    tasks.push({
      title: `🏨 Contatar hotel e enviar e-mail de confirmação — ${client}`,
      description: [
        s.hotel_name ? `Hotel: ${s.hotel_name}` : null,
        s.package_locator ? `Localizador do pacote: ${s.package_locator}` : null,
        'Confirmar reserva com o hotel e enviar e-mail ao cliente.',
      ].filter(Boolean).join('\n'),
      due_date: shiftDate(s.departure_date, -5),
      priority: 'normal',
    })
    tasks.push({
      title: `📋 Enviar briefing ao cliente — ${client}`,
      description: [
        s.destination ? `Destino: ${s.destination}` : null,
        'Enviar o briefing de viagem (documentos, orientações, roteiro) ao cliente.',
      ].filter(Boolean).join('\n'),
      due_date: shiftDate(s.departure_date, -5),
      priority: 'normal',
    })
  }

  if (s.return_date) {
    const checkinInfo = [
      s.air_locator ? `Localizador aéreo: ${s.air_locator}` : null,
      s.airline ? `Cia aérea: ${s.airline}` : null,
    ].filter(Boolean).join('\n')
    tasks.push({
      title: `✈️ Check-in do voo (volta) — ${client}`,
      description: checkinInfo || 'Realizar check-in do voo de volta.',
      due_date: shiftDate(s.return_date, -1),
      priority: 'high',
    })
  }

  let tasksCreated = 0
  if (tasks.length > 0) {
    const { error: tErr } = await supabase.from('tasks').insert(
      tasks.map(t => ({
        organization_id: org.id,
        contato_id: s.contato_id,
        sale_id: id,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        priority: t.priority,
        status: 'open',
        created_by: user.id,
        assigned_to: user.id,
      }))
    )
    if (tErr) return { ok: false as const, error: `Venda salva, mas falhou ao criar tarefas: ${tErr.message}` }
    tasksCreated = tasks.length

    await supabase
      .from('travel_sales')
      .update({ tasks_generated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', org.id)
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, data: s, tasksCreated, alreadyGenerated: false }
}

/**
 * Called from moveLeadToStage when a lead enters a "won" stage.
 * If the org is a travel agency and the lead has a linked proposal without a
 * sale yet, auto-create a pre-filled draft travel sale. Never throws.
 *
 * Uses the caller's RLS client (the acting user must be an org member).
 */
export async function maybeCreateTravelSaleOnWon(
  supabase: ReturnType<typeof createClient>,
  org: { id: string; niche?: string | null },
  leadId: string,
  userId: string,
): Promise<void> {
  try {
    if (!isTravelNiche(org.niche)) return

    // Most recent proposal linked to this lead.
    const { data: proposal } = await supabase
      .from('travel_proposals')
      .select('*')
      .eq('organization_id', org.id)
      .eq('contato_id', leadId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!proposal) return

    // Idempotency: skip if a sale already exists for this proposal.
    const { data: existing } = await supabase
      .from('travel_sales')
      .select('id')
      .eq('organization_id', org.id)
      .eq('proposal_id', proposal.id)
      .maybeSingle()
    if (existing) return

    await supabase.from('travel_sales').insert({
      organization_id: org.id,
      contato_id: leadId,
      proposal_id: proposal.id,
      created_by: userId,
      status: 'open',
      ...mapProposalToSaleFields(proposal),
    })
  } catch (err: any) {
    console.error('[maybeCreateTravelSaleOnWon] error:', err?.message)
  }
}

/**
 * Monta as tarefas sugeridas (por produto, ver lib/reservas/task-templates.ts)
 * pra tela de revisão — não grava nada ainda, só sugere.
 */
export async function getSuggestedTasksForSale(orgSlug: string, saleId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const { listSaleProducts } = await import('@/actions/sale-products')
  const { suggestTasksForProducts } = await import('@/lib/reservas/task-templates')

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('client_name')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const products = await listSaleProducts(orgSlug, saleId)
  const suggestions = suggestTasksForProducts(products, (sale as any).client_name || 'cliente')
  return { ok: true as const, suggestions }
}

/**
 * Grava as tarefas selecionadas pelo agente na tela de "Tarefas sugeridas".
 * Idempotência via travel_sales.tasks_generated_at, igual ao fluxo antigo.
 */
export async function generateTasksFromSuggestions(
  orgSlug: string, saleId: string,
  selected: { title: string; description: string; due_date: string; priority: string; source_product_id: string }[],
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  if (selected.length === 0) return { ok: true as const, tasksCreated: 0 }

  const supabase = createClient()
  const { data: sale } = await supabase
    .from('travel_sales')
    .select('contato_id')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const { error } = await supabase.from('tasks').insert(
    selected.map(t => ({
      organization_id: org.id,
      contato_id: (sale as any).contato_id,
      sale_id: saleId,
      source_product_id: t.source_product_id,
      title: t.title,
      description: t.description,
      due_date: t.due_date,
      priority: t.priority,
      status: 'open',
      created_by: user.id,
      assigned_to: user.id,
    }))
  )
  if (error) return { ok: false as const, error: error.message }

  await supabase
    .from('travel_sales')
    .update({ tasks_generated_at: new Date().toISOString() })
    .eq('id', saleId)
    .eq('organization_id', org.id)

  revalidatePath(`/app/${orgSlug}/reservas`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, tasksCreated: selected.length }
}
