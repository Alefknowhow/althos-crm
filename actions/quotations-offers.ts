'use server'

/**
 * Public link generation, offers list/create, offer<->quotation
 * conversion, and sale creation from a quotation.
 * Split out of actions/quotations.ts.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath, revalidateTag } from 'next/cache'


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
      const copies = (rows as any[]).map(({ id: _id, created_at: _ca, quotation_id: _qid, ...r }) => ({ ...r, quotation_id: newId }))
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
      const copies = (rows as any[]).map(({ id: _id, created_at: _ca, quotation_id: _qid, ...r }) => ({ ...r, quotation_id: newId }))
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
