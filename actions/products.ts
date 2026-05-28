'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization, isImpersonating } from '@/lib/supabase/types'
import { productInputSchema } from '@/lib/validators/product'
import { revalidatePath } from 'next/cache'

export async function createProduct(orgSlug: string, input: any) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const validation = productInputSchema.safeParse(input)
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const { data, error } = await supabase.from('products').insert({
    ...validation.data,
    organization_id: org.id,
  }).select().single()

  if (error) {
    // Bubble up the real DB error so the user can see what's wrong (e.g.,
    // duplicate SKU, RLS denial) instead of a silent generic message.
    return { ok: false, error: error.message || 'Erro ao criar item no catálogo' }
  }

  revalidatePath(`/app/${orgSlug}/catalogo`)
  return { ok: true, data }
}

export async function updateProduct(orgSlug: string, id: string, input: any) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const validation = productInputSchema.partial().safeParse(input)
  if (!validation.success) {
    return { ok: false, error: validation.error.issues[0].message }
  }

  const { data, error } = await supabase.from('products')
    .update(validation.data)
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error) return { ok: false, error: error.message || 'Erro ao atualizar item' }

  revalidatePath(`/app/${orgSlug}/catalogo`)
  revalidatePath(`/app/${orgSlug}/catalogo/${id}`)
  return { ok: true, data }
}

export async function deleteProduct(orgSlug: string, id: string) {
  if (isImpersonating()) {
    return { ok: false, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // TODO: Em futuras missões, verificar se existem vendas ou agendamentos vinculados
  // Se houver, fazer soft delete (is_active = false)
  // Por enquanto, hard delete conforme solicitado
  const { error } = await supabase.from('products')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: 'Erro ao excluir item. Ele pode estar vinculado a outros registros.' }

  revalidatePath(`/app/${orgSlug}/catalogo`)
  return { ok: true }
}

export async function listProducts(orgSlug: string, filters: { 
  search?: string, 
  type?: string, 
  category?: string, 
  isActive?: boolean,
  page?: number,
  pageSize?: number
} = {}) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const page = filters.page || 1
  const pageSize = filters.pageSize || 25
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase.from('products').select('*', { count: 'exact' }).eq('organization_id', org.id)

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,category.ilike.%${filters.search}%`)
  }
  
  if (filters.type && filters.type !== 'all') {
    query = query.eq('type', filters.type)
  }
  
  if (filters.category && filters.category !== 'all') {
    query = query.eq('category', filters.category)
  }
  
  if (filters.isActive !== undefined) {
    query = query.eq('is_active', filters.isActive)
  }

  const { data, count, error } = await query
    .order('name')
    .range(from, to)

  if (error) return { ok: false, error: error.message }
  return { ok: true, data, count: count || 0 }
}

export async function getProduct(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, error } = await supabase.from('products')
    .select('*')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (error || !data) return { ok: false, error: 'Item não encontrado' }
  return { ok: true, data }
}

export async function getCategories(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('organization_id', org.id)
    .not('category', 'is', null)

  if (error) return { ok: false, error: error.message }
  
  const categories = Array.from(new Set(data.map(item => item.category)))
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
  return { ok: true, data: categories }
}
