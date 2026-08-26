'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'

export type SaleProductKind =
  | 'aereo' | 'hospedagem' | 'transfer' | 'passeio' | 'cruzeiro' | 'seguro' | 'ingresso' | 'veiculo' | 'outro'

export type SaleProduct = {
  id: string
  organization_id: string
  sale_id: string
  kind: SaleProductKind
  status: 'confirmed' | 'pending'
  sort_order: number
  data: Record<string, any>
  created_at: string
  updated_at: string
}

async function authorize(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  return { user, org, allowed: perm.allowed, reason: perm.allowed ? undefined : perm.reason }
}

export async function listSaleProducts(orgSlug: string, saleId: string): Promise<SaleProduct[]> {
  const { org, allowed } = await authorize(orgSlug)
  if (!allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('sale_products')
    .select('*')
    .eq('organization_id', org.id)
    .eq('sale_id', saleId)
    .order('sort_order', { ascending: true })
  return (data as SaleProduct[]) ?? []
}

export async function createSaleProduct(
  orgSlug: string, saleId: string, input: { kind: SaleProductKind; data: Record<string, any>; status?: 'confirmed' | 'pending' },
) {
  const { user, org, allowed, reason } = await authorize(orgSlug)
  if (!allowed) return { ok: false as const, error: reason }
  const supabase = createClient()

  const { data: sale } = await supabase
    .from('travel_sales')
    .select('id')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const { count } = await supabase
    .from('sale_products')
    .select('id', { count: 'exact', head: true })
    .eq('sale_id', saleId)

  const { data, error } = await supabase
    .from('sale_products')
    .insert({
      organization_id: org.id,
      sale_id: saleId,
      kind: input.kind,
      status: input.status || 'pending',
      sort_order: count || 0,
      data: input.data || {},
    })
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao adicionar produto' }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, product: data as SaleProduct }
}

export async function updateSaleProduct(
  orgSlug: string, id: string, input: { data?: Record<string, any>; status?: 'confirmed' | 'pending' },
) {
  const { org, allowed, reason } = await authorize(orgSlug)
  if (!allowed) return { ok: false as const, error: reason }
  const supabase = createClient()

  const patch: Record<string, any> = { updated_at: new Date().toISOString() }
  if (input.data) patch.data = input.data
  if (input.status) patch.status = input.status

  const { data, error } = await supabase
    .from('sale_products')
    .update(patch)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !data) return { ok: false as const, error: error?.message || 'Erro ao atualizar produto' }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, product: data as SaleProduct }
}

export async function deleteSaleProduct(orgSlug: string, id: string) {
  const { org, allowed, reason } = await authorize(orgSlug)
  if (!allowed) return { ok: false as const, error: reason }
  const supabase = createClient()
  const { error } = await supabase
    .from('sale_products')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}

/**
 * Consome a saída já estruturada de extractTravelDocument (voos/hospedagens/
 * cruzeiros/transfers/seguros) e cria um sale_product por item — em vez de
 * achatar tudo em campos únicos como o fluxo antigo fazia.
 */
export async function bulkCreateSaleProductsFromExtraction(
  orgSlug: string, saleId: string, extracted: ExtractedTravelDocument,
) {
  const { org, allowed, reason } = await authorize(orgSlug)
  if (!allowed) return { ok: false as const, error: reason }
  const supabase = createClient()

  const { data: sale } = await supabase
    .from('travel_sales')
    .select('id')
    .eq('id', saleId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!sale) return { ok: false as const, error: 'Venda não encontrada.' }

  const rows: { organization_id: string; sale_id: string; kind: SaleProductKind; status: 'pending'; sort_order: number; data: Record<string, any> }[] = []
  let i = 0

  // Agrupa os trechos por sentido — cada conexão não vira um "voo"
  // separado, vira um trecho dentro do voo de ida ou do voo de volta.
  const voos = extracted.voos || []
  const idaLegs = voos.filter(v => v.sentido !== 'volta')
  const voltaLegs = voos.filter(v => v.sentido === 'volta')
  for (const [sentido, legs] of [['ida', idaLegs], ['volta', voltaLegs]] as const) {
    if (legs.length === 0) continue
    const first = legs[0]
    const last = legs[legs.length - 1]
    rows.push({
      organization_id: org.id, sale_id: saleId, kind: 'aereo', status: 'pending', sort_order: i++,
      data: {
        companhia: first.companhia || null, numero_voo: first.numero || null, data: first.data || null,
        origem: first.origem_codigo || first.origem || null, destino: last.destino_codigo || last.destino || null,
        horario: first.horario || null, sentido,
        localizador: first.localizador_checkin || extracted.localizador_aereo || null,
        bilhete: first.bilhete || null,
        hora_embarque: first.hora_embarque || null,
        data_chegada: last.data_chegada || null,
        hora_chegada: last.hora_chegada || null,
        bagagem: first.bagagem || null,
        legs: legs.map(l => ({
          companhia: l.companhia || null, numero: l.numero || null, data: l.data || null,
          origem: l.origem_codigo || l.origem || null, destino: l.destino_codigo || l.destino || null,
          horario: l.horario || null,
          localizador_checkin: l.localizador_checkin || null, bilhete: l.bilhete || null,
          hora_embarque: l.hora_embarque || null, data_chegada: l.data_chegada || null, hora_chegada: l.hora_chegada || null,
          duracao: l.duracao || null, bagagem: l.bagagem || null,
          escala_local: l.escala_local || null, escala_duracao: l.escala_duracao || null,
        })),
      },
    })
  }
  for (const h of extracted.hospedagens || []) {
    rows.push({
      organization_id: org.id, sale_id: saleId, kind: 'hospedagem', status: 'pending', sort_order: i++,
      data: {
        hotel: h.nome || null, check_in: h.check_in || null, check_out: h.check_out || null,
        tipo_quarto: h.categoria_quarto || null, regime: h.regime || null,
      },
    })
  }
  for (const c of extracted.cruzeiros || []) {
    rows.push({
      organization_id: org.id, sale_id: saleId, kind: 'cruzeiro', status: 'pending', sort_order: i++,
      data: {
        companhia: c.companhia || null, navio: c.navio || null, roteiro: c.roteiro || null,
        embarque_porto: c.embarque_porto || null, embarque_data: c.embarque_data || null,
        desembarque_porto: c.desembarque_porto || null, desembarque_data: c.desembarque_data || null,
        cabine: c.cabine || null,
      },
    })
  }
  for (const t of extracted.transfers || []) {
    rows.push({
      organization_id: org.id, sale_id: saleId, kind: 'transfer', status: 'pending', sort_order: i++,
      data: {
        origem: t.origem || null, destino: t.destino || null, data: t.data || null,
        horario: t.horario || null, tipo_servico: t.tipo || null,
      },
    })
  }
  for (const s of extracted.seguros || []) {
    rows.push({
      organization_id: org.id, sale_id: saleId, kind: 'seguro', status: 'pending', sort_order: i++,
      data: s as Record<string, any>,
    })
  }

  if (rows.length === 0) return { ok: true as const, created: 0 }

  const { error } = await supabase.from('sale_products').insert(rows)
  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, created: rows.length }
}
