'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isTravelNiche } from '@/lib/niche'
import { revalidatePath } from 'next/cache'

export type TravelSaleRow = {
  id: string
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
  airline_checkin_url: string | null
  commission_cents: number
  notes: string | null
  tasks_generated_at: string | null
  created_at: string
  updated_at: string
}

const WRITABLE = [
  'status', 'client_name', 'destination', 'departure_date', 'return_date',
  'negotiation_days', 'total_cents', 'hotel_name', 'airline', 'operator', 'services',
  'included_items', 'vouchers', 'travelers', 'travelers_note',
  'payment_method', 'package_locator', 'air_locator', 'airline_checkin_url',
  'commission_cents', 'notes',
] as const

function pick(input: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {}
  for (const k of WRITABLE) if (k in input) out[k] = input[k]
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

export async function listTravelSales(orgSlug: string): Promise<TravelSaleRow[]> {
  const org = await getCurrentOrganization(orgSlug)
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
  const org = await getCurrentOrganization(orgSlug)
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
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
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
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: data as TravelSaleRow }
}

export async function deleteTravelSale(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
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
 */
export async function createTravelSale(orgSlug: string, proposalId?: string | null) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  let prefill: Record<string, any> = {}
  let leadId: string | null = null
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
    leadId = (proposal as any).contato_id ?? null
    linkedProposalId = (proposal as any).id
  }

  const { data, error } = await supabase
    .from('travel_sales')
    .insert({
      organization_id: org.id,
      contato_id: leadId,
      proposal_id: linkedProposalId,
      created_by: user.id,
      status: 'open',
      ...prefill,
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
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
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

  if (s.tasks_generated_at) {
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, data: s, tasksCreated: 0, alreadyGenerated: true }
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
