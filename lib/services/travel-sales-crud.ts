// Internal services: callers must supply an authenticated, organization-scoped context.
import { pick,type TravelSaleRow } from '@/actions/travel-sales-shared'
import { revalidatePath } from 'next/cache'
import type { ActionContext } from './context'

export async function updateTravelSaleCore(ctx: ActionContext, id: string, input: Record<string, any>) {
  const orgSlug = ctx.org.slug

  const org = ctx.org
  const perm = await ctx.checkPermission(['reservas'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = ctx.supabase
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
  const { syncSaleRevenueEntryCore } = await import('@/lib/services/financial-sales-sync')
  await syncSaleRevenueEntryCore(ctx, {
    id: s.id, contato_id: s.contato_id, client_name: s.client_name,
    operator: s.operator, commission_cents: s.commission_cents ?? null,
    retained_commission_cents: s.retained_commission_cents ?? null,
    created_at: s.created_at,
  })

  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const, data: s }
}

export async function deleteTravelSaleCore(ctx: ActionContext, id: string) {
  const orgSlug = ctx.org.slug
  if (ctx.impersonating) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }

  const org = ctx.org
  const perm = await ctx.checkPermission(['reservas'])
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = ctx.supabase
  const { error } = await supabase
    .from('travel_sales')
    .delete()
    .eq('id', id)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message || 'Erro ao excluir venda' }
  revalidatePath(`/app/${orgSlug}/reservas`)
  return { ok: true as const }
}
