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
/**
 * Produto de uma cotação (Construtor de Viagens) — infraestrutura única
 * pra Aéreo/Hospedagem/Cruzeiro/Transfer/Passeio/Seguro/Locação. Campos
 * comuns (name/summary/datas/preço) ficam tipados; o que é específico de
 * cada tipo vive em `data` (jsonb solto — cada editor de produto sabe o
 * que ler/gravar ali, sem exigir migração de schema pra tipo novo).
 * `internal_data` é comercial interno (comissão, markup, fornecedor,
 * custo, margem, código de tarifa) — nunca sai pro público/PDF.
 */
const PRODUCT_TYPES = ['aereo', 'hospedagem', 'cruzeiro', 'transfer', 'passeio', 'seguro', 'locacao'] as const

const ProductSchema = z.object({
  product_type: z.enum(PRODUCT_TYPES),
  name: z.string().max(200).nullable().optional(),
  summary: z.string().max(300).nullable().optional(),
  date_start: z.string().nullable().optional(),
  date_end: z.string().nullable().optional(),
  price_cents: z.number().int().nullable().optional(),
  data: z.record(z.string(), z.any()).default({}),
  internal_data: z.record(z.string(), z.any()).default({}),
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
  flights_html: z.string().max(60000).nullable().optional(),
  flight_fare_conditions: z.array(z.enum(['nao_reembolsavel', 'alteracao_com_custo', 'nao_permite_alteracao'])).max(3).optional(),
  tours_html: z.string().max(60000).nullable().optional(),
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
  signature_enabled: z.boolean().optional(),
  signature_name: z.string().max(160).nullable().optional(),
  signature_photo_url: z.string().url().nullable().optional(),
  signature_message: z.string().max(600).nullable().optional(),
  signature_bg_color: z.string().max(20).nullable().optional(),
  signature_text_color: z.string().max(20).nullable().optional(),
  footer_override: z.boolean().optional(),
  footer_legal_name: z.string().max(160).nullable().optional(),
  footer_logo_url: z.string().url().nullable().optional(),
  footer_address: z.string().max(300).nullable().optional(),
  footer_cnpj: z.string().max(40).nullable().optional(),
  footer_cadastur: z.string().max(60).nullable().optional(),
  footer_instagram_url: z.string().max(300).nullable().optional(),
  footer_site_url: z.string().max(300).nullable().optional(),
  footer_whatsapp_number: z.string().max(30).nullable().optional(),
  footer_phone: z.string().max(30).nullable().optional(),
  footer_email: z.string().max(160).nullable().optional(),
  products: z.array(ProductSchema).max(40).optional(),
  itinerary_days: z.array(DaySchema).max(30).optional(),
  map_pins: z.array(PinSchema).max(30).optional(),
})

export type QuotationInput = z.infer<typeof QuotationSchema>

export type QuotationFull = {
  quotation: Record<string, any>
  products: Record<string, any>[]
  itinerary_days: Record<string, any>[]
  map_pins: Record<string, any>[]
  org_settings: Record<string, any> | null
}

/* ─────────── leitura completa (editor) ─────────── */
export async function getQuotationFull(orgSlug: string, id: string): Promise<QuotationFull | null> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return null
  const supabase = createClient()

  const { data: q } = await supabase
    .from('travel_proposals').select('*')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!q) return null

  const [pr, d, p, s] = await Promise.all([
    supabase.from('quotation_products').select('*').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_itinerary_days').select('*').eq('quotation_id', id).order('sort_order'),
    supabase.from('quotation_map_pins').select('*').eq('quotation_id', id),
    supabase.from('org_settings').select('*').eq('org_id', org.id).maybeSingle(),
  ])

  return {
    quotation: q,
    products: pr.data ?? [],
    itinerary_days: d.data ?? [],
    map_pins: p.data ?? [],
    org_settings: s.data ?? null,
  }
}

/* ─────────── resumo de produtos (preview da lista) ─────────── */
export type QuotationProductSummaryRow = { product_type: string; name: string | null }

/** Lista enxuta (tipo + nome) dos produtos de uma cotação — usada no resumo
 *  "Hospedagem, Aéreo, ..." do painel de preview, sem carregar o editor todo. */
export async function getQuotationProductsSummary(orgSlug: string, id: string): Promise<QuotationProductSummaryRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('quotation_products')
    .select('product_type, name')
    .eq('quotation_id', id)
    .eq('organization_id', org.id)
    .order('sort_order')
  return (data as QuotationProductSummaryRow[]) ?? []
}

/* ─────────── gravação (autosave) ─────────── */
export async function saveQuotation(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = QuotationSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }
  const v = parsed.data

  const supabase = createClient()
  const { data: existing } = await supabase
    .from('travel_proposals').select('id, public_token')
    .eq('id', id).eq('organization_id', org.id).maybeSingle()
  if (!existing) return { ok: false as const, error: 'Cotação não encontrada' }

  const { products, itinerary_days, map_pins, ...parent } = v

  const clean = (s?: string | null) => (s == null ? s : s === '' ? null : s)
  const parentPatch: Record<string, any> = {
    ...parent,
    start_date: clean(parent.start_date as any),
    end_date: clean(parent.end_date as any),
    updated_at: new Date().toISOString(),
  }

  // Ofertas marcadas como "Publicada na vitrine" precisam de um public_token —
  // a RPC get_public_vitrine só retorna ofertas com offer_published=true E
  // public_token preenchido. Sem isso, o toggle "Publicada" não tinha efeito
  // nenhum na vitrine pública se o usuário nunca tivesse gerado o link antes.
  if (parentPatch.offer_published === true && !existing.public_token) {
    parentPatch.public_token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
  }

  const { error: upErr } = await supabase
    .from('travel_proposals').update(parentPatch)
    .eq('id', id).eq('organization_id', org.id)
  if (upErr) return { ok: false as const, error: upErr.message }

  // Filhas: substituição integral (listas pequenas; mantém sort_order simples).
  async function replaceChildren(table: string, rows: Record<string, any>[] | undefined, withSort = true, extra?: Record<string, any>) {
    if (rows === undefined) return null
    const del = await supabase.from(table).delete().eq('quotation_id', id)
    if (del.error) return del.error.message
    if (rows.length === 0) return null
    const ins = await supabase.from(table).insert(
      rows.map((r, i) => ({
        ...r,
        quotation_id: id,
        ...(extra || {}),
        ...(withSort ? { sort_order: i } : {}),
        check_in: clean(r.check_in), check_out: clean(r.check_out), date: clean(r.date),
        date_start: clean(r.date_start), date_end: clean(r.date_end),
      })).map(r => Object.fromEntries(Object.entries(r).filter(([, val]) => val !== undefined))),
    )
    return ins.error?.message ?? null
  }

  const errs = [
    await replaceChildren('quotation_products', products, true, { organization_id: org.id }),
    await replaceChildren('quotation_itinerary_days', itinerary_days),
    await replaceChildren('quotation_map_pins', map_pins, false),
  ].filter(Boolean)
  if (errs.length) return { ok: false as const, error: errs[0] as string }

  if (existing.public_token) revalidateTag(`quotation:${existing.public_token}`)
  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const }
}

/* ─────────── perfis de rodapé/identidade salvos (marca 2ª agência) ─────────── */
export type FooterProfileRow = {
  id: string
  name: string
  legal_name: string | null
  logo_url: string | null
  address: string | null
  cnpj: string | null
  cadastur: string | null
  instagram_url: string | null
  site_url: string | null
  whatsapp_number: string | null
  phone: string | null
  email: string | null
}

const FooterProfileSchema = z.object({
  name: z.string().min(1).max(120),
  legal_name: z.string().max(160).nullable().optional(),
  logo_url: z.string().url().nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  cnpj: z.string().max(40).nullable().optional(),
  cadastur: z.string().max(60).nullable().optional(),
  instagram_url: z.string().max(300).nullable().optional(),
  site_url: z.string().max(300).nullable().optional(),
  whatsapp_number: z.string().max(30).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().max(160).nullable().optional(),
})

export async function listFooterProfiles(orgSlug: string): Promise<FooterProfileRow[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('quotation_footer_profiles')
    .select('id, name, legal_name, logo_url, address, cnpj, cadastur, instagram_url, site_url, whatsapp_number, phone, email')
    .eq('organization_id', org.id)
    .order('name', { ascending: true })
  return (data as FooterProfileRow[]) ?? []
}

export async function createFooterProfile(orgSlug: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = FooterProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { data, error } = await supabase
    .from('quotation_footer_profiles')
    .insert({ organization_id: org.id, ...parsed.data })
    .select('id').single()

  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe uma marca salva com esse nome.' }
    return { ok: false as const, error: error.message || 'Erro ao salvar a marca.' }
  }
  return { ok: true as const, id: (data as any).id }
}

export async function updateFooterProfile(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const parsed = FooterProfileSchema.safeParse(input)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const { error } = await supabase
    .from('quotation_footer_profiles')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id).eq('organization_id', org.id)

  if (error) {
    if (error.code === '23505') return { ok: false as const, error: 'Já existe uma marca salva com esse nome.' }
    return { ok: false as const, error: error.message || 'Erro ao salvar a marca.' }
  }
  return { ok: true as const }
}

export async function deleteFooterProfile(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('quotation_footer_profiles')
    .delete()
    .eq('id', id).eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao remover a marca.' }
  return { ok: true as const }
}

/* ─────────── gerar/rotacionar link ─────────── */
export async function generateQuotationLink(orgSlug: string, id: string, rotate = false) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
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
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return []
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
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
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
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
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
  for (const table of ['quotation_products', 'quotation_itinerary_days', 'quotation_map_pins'] as const) {
    const { data: rows } = await supabase.from(table).select('*').eq('quotation_id', offerId)
    if (rows?.length) {
      const copies = (rows as any[]).map(({ id, created_at, quotation_id, ...r }) => ({ ...r, quotation_id: newId }))
      await supabase.from(table).insert(copies)
    }
  }

  revalidatePath(`/app/${orgSlug}/cotacoes`)
  return { ok: true as const, id: newId }
}

/**
 * Inverso de convertOfferToQuotation: transforma uma cotação normal numa
 * oferta (vitrine) — cria uma cópia como oferta em rascunho, sem apagar a
 * cotação original nem os dados do cliente que gerou a venda.
 */
export async function convertQuotationToOffer(orgSlug: string, quotationId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: quotation } = await supabase
    .from('travel_proposals').select('*')
    .eq('id', quotationId).eq('organization_id', org.id).eq('is_offer', false).maybeSingle()
  if (!quotation) return { ok: false as const, error: 'Cotação não encontrada' }

  const q = quotation as Record<string, any>
  const {
    id: _id, created_at: _c, updated_at: _u, public_token: _t, is_offer: _o,
    client_name: _cn, client_whatsapp: _cw, contato_id: _ct, quoted_at: _q, status: _st, ...rest
  } = q
  const { data: created, error } = await supabase
    .from('travel_proposals')
    .insert({ ...rest, organization_id: org.id, created_by: user.id, contato_id: null, is_offer: true, offer_published: false, status: 'draft' })
    .select('id').single()
  if (error || !created) return { ok: false as const, error: error?.message || 'Erro ao converter' }
  const newId = (created as any).id

  for (const table of ['quotation_products', 'quotation_itinerary_days', 'quotation_map_pins'] as const) {
    const { data: rows } = await supabase.from(table).select('*').eq('quotation_id', quotationId)
    if (rows?.length) {
      const copies = (rows as any[]).map(({ id, created_at, quotation_id, ...r }) => ({ ...r, quotation_id: newId }))
      await supabase.from(table).insert(copies)
    }
  }

  revalidatePath(`/app/${orgSlug}/ofertas`)
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
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
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

  const { data: products } = await supabase
    .from('quotation_products').select('product_type, name, data').eq('quotation_id', id).order('sort_order')
  const lodgingRows = (products || []).filter((p: any) => p.product_type === 'hospedagem')
  const flightRows = (products || []).filter((p: any) => p.product_type === 'aereo')

  const destination = (Array.isArray(q.destinations) ? q.destinations : [])
    .map((d: any) => d?.name).filter(Boolean).join(', ') || null
  const hotelName = lodgingRows.map((l: any) => l.name).filter(Boolean).join(', ') || null
  const airline = Array.from(new Set(flightRows.map((f: any) => f.data?.airline).filter(Boolean))).join(', ') || null
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

/* ─────────── TripAdvisor (Terra API — terra.tripadvisor.com, cacheado na montagem) ───────────
 * A API antiga (api.content.tripadvisor.com, autenticada via ?key=) está sendo descontinuada.
 * A Terra API usa outro host e autentica por header X-API-Key. */
const TRIPADVISOR_BASE = 'https://terra.tripadvisor.com/api'

function taHeaders(key: string) {
  return { Accept: 'application/json', 'X-API-Key': key }
}

/** Extrai o texto na localidade preferida (pt) de uma lista de Translation[], com fallback pro primeiro item. */
function pickTranslation(items: any[] | undefined, preferred = 'pt'): string | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined
  return items.find(i => i?.language === preferred)?.value || items[0]?.value
}

export async function tripadvisorLookup(orgSlug: string, query: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }

  const key = process.env.TRIPADVISOR_API_KEY
  if (!key) {
    return { ok: false as const, error: 'TripAdvisor não configurado. Adicione TRIPADVISOR_API_KEY nas variáveis de ambiente.' }
  }
  const q = (query || '').trim()
  if (!q) return { ok: false as const, error: 'Digite o nome do hotel' }

  try {
    const search = await fetch(
      `${TRIPADVISOR_BASE}/catalog/locations/search?query=${encodeURIComponent(q)}&category=HOTEL&locale=pt-BR&size=1`,
      { headers: taHeaders(key), cache: 'no-store' },
    )
    if (!search.ok) return { ok: false as const, error: `TripAdvisor indisponível (${search.status})` }
    const sr = await search.json()
    const loc = sr?.data?.[0]?.location
    if (!loc?.id) return { ok: false as const, error: 'Hotel não encontrado no TripAdvisor' }

    const photoRes = await fetch(
      `${TRIPADVISOR_BASE}/locations/${loc.id}/photos?locale=pt-BR&size=10`,
      { headers: taHeaders(key), cache: 'no-store' },
    )
    const photosJson = photoRes.ok ? await photoRes.json() : { data: [] }

    const data = {
      rating: loc.overall_rating?.rating ? Number(loc.overall_rating.rating) : undefined,
      reviews_count: loc.overall_rating?.count ? Number(loc.overall_rating.count) : undefined,
      url: loc.urls?.official || loc.urls?.tripadvisor?.main || undefined,
      photos: Array.isArray(photosJson?.data)
        ? photosJson.data.map((p: any) => p?.photo?.original_size_url).filter(Boolean)
        : [],
      lat: loc.coordinates?.latitude != null ? Number(loc.coordinates.latitude) : undefined,
      lng: loc.coordinates?.longitude != null ? Number(loc.coordinates.longitude) : undefined,
      address: pickTranslation(loc.addresses?.map((a: any) => ({ language: a.language, value: a.formatted }))),
      description: pickTranslation(loc.descriptions),
    }
    return {
      ok: true as const,
      location_id: String(loc.id),
      name: pickTranslation(loc.names) || q,
      data,
    }
  } catch {
    return { ok: false as const, error: 'Erro ao consultar o TripAdvisor. Tente novamente.' }
  }
}

/* ─────────── Unsplash (busca de foto de capa) ─────────── */
export async function unsplashSearch(orgSlug: string, query: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) {
    return { ok: false as const, error: 'Unsplash não configurado. Adicione UNSPLASH_ACCESS_KEY nas variáveis de ambiente.' }
  }
  const q = (query || '').trim()
  if (!q) return { ok: false as const, error: 'Digite o que buscar (ex.: nome do destino)' }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) return { ok: false as const, error: `Unsplash indisponível (${res.status})` }
    const json = await res.json()
    const results = Array.isArray(json?.results) ? json.results : []
    return {
      ok: true as const,
      photos: results.map((p: any) => ({
        id: p.id as string,
        thumbUrl: p.urls?.small as string,
        fullUrl: (p.urls?.regular || p.urls?.full) as string,
        downloadLocation: p.links?.download_location as string,
        author: p.user?.name as string,
        authorUrl: p.user?.links?.html as string,
      })).filter((p: any) => p.thumbUrl && p.fullUrl),
    }
  } catch {
    return { ok: false as const, error: 'Erro ao consultar o Unsplash. Tente novamente.' }
  }
}

/** Aciona o endpoint de download da Unsplash (obrigatório pelos termos de uso ao usar uma foto). */
export async function unsplashTrackDownload(orgSlug: string, downloadLocation: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const }
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !downloadLocation) return { ok: false as const }
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` }, cache: 'no-store' })
    return { ok: true as const }
  } catch {
    return { ok: false as const }
  }
}
