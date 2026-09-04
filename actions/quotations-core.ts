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
 * Split across quotations-core/footer/offers/external.ts.
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
