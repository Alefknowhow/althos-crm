'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath, revalidateTag } from 'next/cache'

/**
 * Actions da Cotação reformulada (editor split-view).
 * Pai = travel_proposals; filhas = quotation_* (ver migração 0080).
 * Toda gravação revalida a tag do link público (quotation:{token}).
 */

/* ─────────── schemas ─────────── */
const LodgingSchema = z.object({
  name: z.string().max(200).default(''),
  check_in: z.string().nullable().optional(),
  check_out: z.string().nullable().optional(),
  room_category: z.string().max(200).nullable().optional(),
  board: z.string().max(120).nullable().optional(),
  description_html: z.string().max(20000).nullable().optional(),
  photos: z.array(z.string().url()).max(12).default([]),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  tripadvisor_location_id: z.string().max(40).nullable().optional(),
  tripadvisor_data: z.record(z.string(), z.any()).nullable().optional(),
})

const FlightSchema = z.object({
  leg_type: z.enum(['outbound', 'inbound', 'connection']).default('outbound'),
  from_code: z.string().max(8).nullable().optional(),
  from_city: z.string().max(120).nullable().optional(),
  to_code: z.string().max(8).nullable().optional(),
  to_city: z.string().max(120).nullable().optional(),
  airline: z.string().max(120).nullable().optional(),
  date: z.string().nullable().optional(),
  duration_label: z.string().max(60).nullable().optional(),
  stopover_label: z.string().max(160).nullable().optional(),
  baggage: z.array(z.enum(['item_pessoal', 'mao', 'despachada'])).max(3).default([]),
  cabin_class: z.enum(['economica', 'premium', 'executiva', 'primeira']).nullable().optional(),
})

const DaySchema = z.object({
  day_label: z.string().max(60).default(''),
  date: z.string().nullable().optional(),
  title: z.string().max(200).default(''),
  items: z.array(z.string().max(300)).max(20).default([]),
})

const PinSchema = z.object({
  label: z.string().max(160).default(''),
  type: z.enum(['lodging', 'attraction', 'airport', 'custom']).default('attraction'),
  lat: z.number(),
  lng: z.number(),
})

const QuotationSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  subtitle: z.string().max(300).nullable().optional(),
  status: z.enum(['draft', 'sent', 'viewed', 'won', 'lost', 'expired']).optional(),
  contato_id: z.string().uuid().nullable().optional(),
  client_name: z.string().max(160).nullable().optional(),
  client_whatsapp: z.string().max(30).nullable().optional(),
  cover_image_url: z.string().url().nullable().optional(),
  origin_label: z.string().max(120).nullable().optional(),
  origin_note: z.string().max(200).nullable().optional(),
  destinations: z.array(z.object({ name: z.string().max(120).default(''), country: z.string().max(120).optional() })).max(10).optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  pax_adults: z.number().int().min(0).max(99).optional(),
  pax_children: z.number().int().min(0).max(99).optional(),
  children_ages: z.array(z.number().int().min(0).max(17)).max(20).optional(),
  occupancy_label: z.string().max(120).nullable().optional(),
  intro_html: z.string().max(20000).nullable().optional(),
  important_html: z.string().max(20000).nullable().optional(),
  closing_html: z.string().max(20000).nullable().optional(),
  cancellation_html: z.string().max(20000).nullable().optional(),
  itinerary_html: z.string().max(60000).nullable().optional(),
  included: z.array(z.string().max(200)).max(40).optional(),
  not_included: z.array(z.string().max(200)).max(40).optional(),
  price_per_person_cents: z.number().int().min(0).nullable().optional(),
  total_cents: z.number().int().min(0).optional(),
  payment_conditions: z.array(z.object({ label: z.string().max(120).default(''), value: z.string().max(200).default('') })).max(10).optional(),
  price_disclaimer: z.string().max(600).nullable().optional(),
  validity_days: z.number().int().min(1).max(90).optional(),
  operadora: z.string().max(160).nullable().optional(),
  commission_total_cents: z.number().int().min(0).optional(),
  offer_published: z.boolean().optional(),
  offer_category: z.string().max(80).nullable().optional(),
  lodgings: z.array(LodgingSchema).max(10).optional(),
  flights: z.array(FlightSchema).max(20).optional(),
  itinerary_days: z.array(DaySchema).max(30).optional(),
  map_pins: z.array(PinSchema).max(30).optional(),
})

export type QuotationInput = z.infer<typeof QuotationSchema>

export type QuotationFull = {
  quotation: Record<string, any>
  lodgings: Record<string, any>[]
  flights: Record<string, any>[]
  itinerary_days: Record<string, any>[]
  map_pins: Record<string, any>[]
  org_settings: Record<string, any> | null
}

/* ─────────── leitura completa (editor) ─────────── */
export async function getQuotationFull(orgSlug: string, id: string): Promise<QuotationFull | null> {
  await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data: q } = await supabase
    .from('travel_proposals').select('*')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!q) return null

  const [l, f, d, p, s] = await Promise.all([
    supabase.from('quotation_lodgings').select('*').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_flights').select('*').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_itinerary_days').select('*').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_map_pins').select('*').eq('quotation_id', id),
    supabase.from('org_settings').select('*').eq('org_id', org.id).maybeSingle(),
  ])

  return {
    quotation: q,
    lodgings: l.data ?? [],
    flights: f.data ?? [],
    itinerary_days: d.data ?? [],
    map_pins: p.data ?? [],
    org_settings: s.data ?? null,
  }
}

/* ─────────── gravação (autosave) ─────────── */
export async function saveQuotation(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = QuotationSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('travel_proposals').select('id, public_token')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!existing) return { ok: false as const, error: 'Cotação não encontrada' }

  const { lodgings, flights, itinerary_days, map_pins, ...parent } = v

  const clean = (s?: string | null) => (s == null ? s : s === '' ? null : s)
  const parentPatch: Record<string, any> = {
    ...parent,
    start_date: clean(parent.start_date as any),
    end_date: clean(parent.end_date as any),
    updated_at: new Date().toISOString(),
  }

  const { error: upErr } = await supabase
    .from('travel_proposals').update(parentPatch)
    .eq('id', id).eq('organization_id', org.id)
  if (upErr) return { ok: false as const, error: upErr.message }

  // Filhas: substituição integral (listas pequenas; mantém sort_order simples).
  async function replaceChildren(table: string, rows: Record<string, any>[] | undefined, withSort = true) {
    if (rows === undefined) return null
    const del = await supabase.from(table).delete().eq('quotation_id', id)
    if (del.error) return del.error.message
    if (rows.length === 0) return null
    const ins = await supabase.from(table).insert(
      rows.map((r, i) => ({
        ...r,
        quotation_id: id,
        ...(withSort ? { sort_order: i } : {}),
        check_in: clean(r.check_in), check_out: clean(r.check_out), date: clean(r.date),
      })).map(r => Object.fromEntries(Object.entries(r).filter(([, val]) => val !== undefined))),
    )
    return ins.error?.message ?? null
  }

  const errs = [
    await replaceChildren('quotation_lodgings', lodgings),
    await replaceChildren('quotation_flights', flights),
    await replaceChildren('quotation_itinerary_days', itinerary_days),
    await replaceChildren('quotation_map_pins', map_pins, false),
  ].filter(Boolean)
  if (errs.length) return { ok: false as const, error: errs[0] as string }

  if (existing.public_token) revalidateTag(`quotation:${existing.public_token}`)
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const }
}

/* ─────────── gerar/rotacionar link ─────────── */
export async function generateQuotationLink(orgSlug: string, id: string, rotate = false) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: q } = await supabase
    .from('travel_proposals').select('id, public_token, status')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!q) return { ok: false as const, error: 'Cotação não encontrada' }

  const oldToken = q.public_token
  const token = rotate || !oldToken
    ? Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
    : oldToken

  const { error } = await supabase.from('travel_proposals').update({
    public_token: token,
    status: ['draft'].includes(q.status) ? 'sent' : q.status,
    quoted_at: new Date().toISOString(),
  }).eq('id', id)
  if (error) return { ok: false as const, error: error.message }

  if (oldToken && oldToken !== token) revalidateTag(`quotation:${oldToken}`)
  revalidateTag(`quotation:${token}`)
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, token }
}

/* ─────────── ofertas (vitrine) = cotações com is_offer ─────────── */
export type OfferRow = {
  id: string; title: string | null; offer_category: string | null
  offer_published: boolean; cover_image_url: string | null; public_token: string | null
  total_cents: number; price_per_person_cents: number | null; updated_at: string
}

export async function listOffers(orgSlug: string): Promise<OfferRow[]> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('travel_proposals')
    .select('id, title, offer_category, offer_published, cover_image_url, public_token, total_cents, price_per_person_cents, updated_at')
    .eq('organization_id', org.id)
    .eq('is_offer', true)
    .order('updated_at', { ascending: false })
    .limit(500)
  return (data as OfferRow[]) ?? []
}

export async function createOffer(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()
  const { data, error } = await supabase
    .from('travel_proposals')
    .insert({ organization_id: org.id, created_by: user.id, title: 'Nova oferta', status: 'sent', is_offer: true })
    .select('id').single()
  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao criar oferta' }
  revalidatePath(`/app/${orgSlug}/ofertas`)
  return { ok: true as const, id: (data as any).id }
}

/**
 * Converte uma oferta da vitrine numa cotação nova (draft, sem cliente),
 * duplicando pai + tabelas-filhas. A oferta original permanece publicada.
 */
export async function convertOfferToQuotation(orgSlug: string, offerId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: offer } = await supabase
    .from('travel_proposals').select('*')
    .eq('id', offerId).eq('organization_id', org.id).eq('is_offer', true).maybeSingle()
  if (!offer) return { ok: false as const, error: 'Oferta não encontrada' }

  const o = offer as Record<string, any>
  // Campos a copiar (exclui identidade/estado de publicação/token).
  const {
    id: _id, created_at: _c, updated_at: _u, public_token: _t, is_offer: _o,
    offer_published: _op, offer_category: _oc, contato_id: _ct, quoted_at: _q, ...rest
  } = o
  const { data: created, error } = await supabase
    .from('travel_proposals')
    .insert({ ...rest, organization_id: org.id, created_by: user.id, contato_id: null, is_offer: false, offer_published: false, status: 'draft', quoted_at: new Date().toISOString() })
    .select('id').single()
  if (error || !created) return { ok: false as const, error: error?.message || 'Erro ao converter' }
  const newId = (created as any).id

  // Duplica as tabelas-filhas.
  for (const table of ['quotation_lodgings', 'quotation_flights', 'quotation_itinerary_days', 'quotation_map_pins'] as const) {
    const { data: rows } = await supabase.from(table).select('*').eq('quotation_id', offerId)
    if (rows?.length) {
      const copies = (rows as any[]).map(({ id, created_at, quotation_id, ...r }) => ({ ...r, quotation_id: newId }))
      await supabase.from(table).insert(copies)
    }
  }

  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, id: newId }
}

/* ─────────── gerar venda a partir da cotação ─────────── */
/**
 * Cria uma venda (travel_sales) pré-preenchida com os dados atuais da
 * cotação — lendo o schema novo (pai + tabelas-filhas). Idempotente: se já
 * existe venda vinculada a esta cotação, retorna a existente (sem duplicar).
 */
export async function createSaleFromQuotation(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { data: q } = await supabase
    .from('travel_proposals').select('*')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!q) return { ok: false as const, error: 'Cotação não encontrada' }

  // Idempotência: uma venda por cotação.
  const { data: existing } = await supabase
    .from('travel_sales').select('id')
    .eq('organization_id', org.id).eq('proposal_id', id).maybeSingle()
  if (existing) return { ok: true as const, saleId: (existing as any).id, existed: true }

  const [lodg, fl] = await Promise.all([
    supabase.from('quotation_lodgings').select('name').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_flights').select('airline').eq('quotation_id', id).order('sort_order'),
  ])

  const destination = (Array.isArray(q.destinations) ? q.destinations : [])
    .map((d: any) => d?.name).filter(Boolean).join(', ') || null
  const hotelName = (lodg.data || []).map((l: any) => l.name).filter(Boolean).join(', ') || null
  const airline = Array.from(new Set((fl.data || []).map((f: any) => f.airline).filter(Boolean))).join(', ') || null
  const paymentMethod = (Array.isArray(q.payment_conditions) ? q.payment_conditions : [])
    .map((p: any) => p?.label).filter(Boolean).join(', ') || null

  let negotiationDays: number | null = null
  if (q.created_at) negotiationDays = Math.max(0, Math.round((Date.now() - new Date(q.created_at).getTime()) / 86400000))

  const { data: sale, error } = await supabase
    .from('travel_sales')
    .insert({
      organization_id: org.id,
      contato_id: q.contato_id ?? null,
      proposal_id: q.id,
      created_by: user.id,
      status: 'open',
      client_name: q.client_name,
      destination,
      departure_date: q.start_date,
      return_date: q.end_date,
      negotiation_days: negotiationDays,
      total_cents: q.total_cents || 0,
      hotel_name: hotelName,
      airline,
      operator: q.operadora ?? null,
      included_items: Array.isArray(q.included) ? q.included : [],
      travelers_note: q.occupancy_label ?? null,
      payment_method: paymentMethod,
      commission_cents: q.commission_total_cents || 0,
    })
    .select('id, client_name')
    .single()

  if (error || !sale) return { ok: false as const, error: error?.message || 'Erro ao criar venda' }

  const { createNotification } = await import('@/actions/notifications')
  await createNotification({
    organizationId: org.id,
    type: 'new_sale',
    title: 'Nova venda viagem criada',
    content: (sale as any).client_name ? `Venda iniciada para ${(sale as any).client_name}.` : 'Uma nova venda viagem foi iniciada.',
    link: `/app/${orgSlug}/reservas`,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, saleId: (sale as any).id, existed: false }
}

/* ─────────── TripAdvisor (Content API, cacheado na montagem) ─────────── */
export async function tripadvisorLookup(orgSlug: string, query: string) {
  await requireAuth()
  await getCurrentOrganization(orgSlug)

  const key = process.env.TRIPADVISOR_API_KEY
  if (!key) {
    return { ok: false as const, error: 'TripAdvisor não configurado. Adicione TRIPADVISOR_API_KEY nas variáveis de ambiente.' }
  }
  const q = (query || '').trim()
  if (!q) return { ok: false as const, error: 'Digite o nome do hotel' }

  try {
    const search = await fetch(
      `https://api.content.tripadvisor.com/api/v1/location/search?key=${key}&searchQuery=${encodeURIComponent(q)}&category=hotels&language=pt`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' },
    )
    if (!search.ok) return { ok: false as const, error: `TripAdvisor indisponível (${search.status})` }
    const sr = await search.json()
    const loc = sr?.data?.[0]
    if (!loc?.location_id) return { ok: false as const, error: 'Hotel não encontrado no TripAdvisor' }

    const [detRes, photoRes] = await Promise.all([
      fetch(`https://api.content.tripadvisor.com/api/v1/location/${loc.location_id}/details?key=${key}&language=pt&currency=BRL`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }),
      fetch(`https://api.content.tripadvisor.com/api/v1/location/${loc.location_id}/photos?key=${key}&language=pt&limit=5`,
        { headers: { Accept: 'application/json' }, cache: 'no-store' }),
    ])
    const det = detRes.ok ? await detRes.json() : {}
    const photos = photoRes.ok ? await photoRes.json() : {}

    const data = {
      rating: det.rating ? Number(det.rating) : undefined,
      reviews_count: det.num_reviews ? Number(det.num_reviews) : undefined,
      url: det.web_url || undefined,
      photos: Array.isArray(photos?.data)
        ? photos.data.map((p: any) => p?.images?.large?.url || p?.images?.original?.url).filter(Boolean)
        : [],
      lat: det.latitude ? Number(det.latitude) : undefined,
      lng: det.longitude ? Number(det.longitude) : undefined,
      address: det.address_obj?.address_string || undefined,
    }
    return {
      ok: true as const,
      location_id: String(loc.location_id),
      name: det.name || loc.name || q,
      data,
    }
  } catch {
    return { ok: false as const, error: 'Erro ao consultar o TripAdvisor. Tente novamente.' }
  }
}
