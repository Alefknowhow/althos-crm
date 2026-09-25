'use server'

/**
 * Vincula itens do Catálogo (issue #21) a uma Oportunidade (contato) — "Uma
 * Oportunidade pode selecionar um ou vários itens; ao ganhar, esses itens
 * podem originar a Venda." A criação automática de Venda fica pra issue #20
 * (ainda não existe); aqui só a seleção/precificação na oportunidade.
 *
 * Preço gravado como snapshot no momento em que o item é adicionado
 * (unit_price_cents) — igual à regra de Vendas: mudar o preço no Catálogo
 * depois não altera o que já foi selecionado numa oportunidade em aberto.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkContatoPermission } from './contatos-shared'
import { revalidatePath } from 'next/cache'

export async function listContatoCatalogItems(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return []
  const supabase = createClient()

  const { data } = await supabase
    .from('contato_catalog_items')
    .select('id, product_id, quantity, unit_price_cents, created_at, products(name, type)')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .order('created_at', { ascending: true })

  return data || []
}

export async function addContatoCatalogItem(
  orgSlug: string,
  contatoId: string,
  productId: string,
  quantity: number = 1,
) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { data: product } = await supabase
    .from('products')
    .select('price_cents')
    .eq('id', productId)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (!product) return { ok: false as const, error: 'Item do catálogo não encontrado' }

  const { data, error } = await supabase
    .from('contato_catalog_items')
    .insert({
      organization_id: org.id,
      contato_id: contatoId,
      product_id: productId,
      quantity: Math.max(1, Math.floor(quantity) || 1),
      unit_price_cents: product.price_cents ?? 0,
    })
    .select('id, product_id, quantity, unit_price_cents, created_at, products(name, type)')
    .single()

  if (error) return { ok: false as const, error: error.message || 'Erro ao adicionar item' }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const, item: data }
}

export async function updateContatoCatalogItemQuantity(orgSlug: string, itemId: string, quantity: number) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const safeQuantity = Math.max(1, Math.floor(quantity) || 1)
  const { error } = await supabase
    .from('contato_catalog_items')
    .update({ quantity: safeQuantity })
    .eq('id', itemId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao atualizar quantidade' }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function removeContatoCatalogItem(orgSlug: string, itemId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkContatoPermission(org.id, user.id)
  if (!perm.allowed) return { ok: false as const, error: perm.reason }
  const supabase = createClient()

  const { error } = await supabase
    .from('contato_catalog_items')
    .delete()
    .eq('id', itemId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao remover item' }
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}
