'use server'

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { saleInputSchema } from '@/lib/validators/sale'

export async function listSales(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const { data, error } = await supabase
    .from('sales')
    .select('*, leads(id, name), products(id, name, type)')
    .eq('organization_id', org.id)
    .order('sale_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    console.error('listSales error:', error)
    return []
  }
  return data || []
}

export async function getSale(orgSlug: string, id: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data, error } = await supabase
    .from('sales')
    .select('*, leads(id, name), products(id, name, type, price_cents)')
    .eq('id', id)
    .eq('organization_id', org.id)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: 'Venda não encontrada' }
  return { ok: true, data }
}

export async function createSale(orgSlug: string, input: unknown) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const parsed = saleInputSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message || 'Dados inválidos' }
  }

  const v = parsed.data
  const { data, error } = await supabase.from('sales').insert({
    organization_id: org.id,
    lead_id: v.lead_id || null,
    product_id: v.product_id || null,
    seller_id: v.seller_id || user.id,
    sale_date: v.sale_date,
    quantity: v.quantity,
    amount_cents: v.amount_cents,
    payment_method: v.payment_method || null,
    installments: v.installments || 1,
    status: v.status,
    notes: v.notes || null,
  }).select().single()

  if (error) {
    console.error('createSale error:', error)
    return { ok: false, error: error.message || 'Erro ao registrar venda' }
  }

  // Push: notify opted-in members of the new sale (best-effort, honours the
  // 'new_sale' notification preference per member).
  try {
    const { sendPushToOrg } = await import('@/actions/push')
    const value = ((v.amount_cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    await sendPushToOrg(org.id, {
      title: 'Nova venda registrada',
      body: `Venda de ${value} registrada.`,
      url: `/app/${orgSlug}/vendas`,
      tag: `new-sale-${org.id}`,
      category: 'new_sale',
    })
  } catch (e: any) {
    console.warn('[createSale] push new_sale failed:', e?.message)
  }

  revalidatePath(`/app/${orgSlug}/vendas`)
  return { ok: true, data }
}

export async function updateSale(orgSlug: string, id: string, input: unknown) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const parsed = saleInputSchema.partial().safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message || 'Dados inválidos' }
  }

  const { error } = await supabase
    .from('sales')
    .update(parsed.data)
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false, error: error.message }
  revalidatePath(`/app/${orgSlug}/vendas`)
  return { ok: true }
}

export async function deleteSale(orgSlug: string, id: string) {
  const user = await requireAuth()
  const org  = await getCurrentOrganization(orgSlug)

  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { error } = await supabase
    .from('sales')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/vendas`)
  return { ok: true as const }
}

// Returns active products for the sale dialog selector.
export async function listActiveProducts(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('products')
    .select('id, name, type, price_cents')
    .eq('organization_id', org.id)
    .eq('is_active', true)
    .order('name')
  return data || []
}

// Returns members of the organization with display info, used for the
// "Vendedor" selector. Uses admin client to read auth.users emails since
// we don't keep a profiles table yet.
export async function listOrgMembers(orgSlug: string) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data: memberships } = await supabase
    .from('memberships')
    .select('user_id, role')
    .eq('organization_id', org.id)

  if (!memberships || memberships.length === 0) return []

  const admin = createAdminClient()
  const members = await Promise.all(
    memberships.map(async (m) => {
      const { data } = await admin.auth.admin.getUserById(m.user_id)
      return {
        id: m.user_id,
        role: m.role,
        email: data?.user?.email || '',
        name: (data?.user?.user_metadata as any)?.name || data?.user?.email || 'Usuário',
      }
    })
  )
  return members
}
