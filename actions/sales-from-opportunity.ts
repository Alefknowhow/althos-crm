'use server'

/**
 * "Contato → Oportunidade → Venda" (issue #20) — fecha o loop deixado em
 * aberto na issue #21: uma Oportunidade pode selecionar itens do Catálogo
 * (contato_catalog_items); ao vender, esses itens originam uma Venda com
 * snapshot próprio (sale_items) — mudanças futuras no Catálogo não alteram
 * retroativamente o que já foi vendido.
 *
 * Ação explícita do usuário (botão), não automática — moveLeadToStage() já
 * tem efeitos colaterais demais pra ganhar mais um encadeado sem transação.
 */

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { isAccessBlocked } from '@/lib/billing/plans'
import { inngest } from '@/lib/inngest/client'
import { revalidatePath } from 'next/cache'

const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'

export async function createSaleFromContatoCatalogItems(orgSlug: string, contatoId: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }

  const perm = await checkMemberPermission(org.id, user.id, 'sales')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()

  const { data: items, error: itemsError } = await supabase
    .from('contato_catalog_items')
    .select('product_id, quantity, unit_price_cents, products(name, description, is_recurring, duration_months)')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)

  if (itemsError) return { ok: false as const, error: itemsError.message }
  if (!items || items.length === 0) {
    return { ok: false as const, error: 'Esta oportunidade não tem itens do catálogo selecionados.' }
  }

  const totalCents = items.reduce((acc, it) => acc + it.unit_price_cents * it.quantity, 0)
  // sales.product_id/quantity são colunas singulares (schema legado, usadas
  // por dashboards/relatórios) — só preenchidas quando a venda tem
  // exatamente 1 item; venda com múltiplos itens deixa null (o total já
  // reflete a soma, e o detalhamento real fica em sale_items).
  const singleItem = items.length === 1 ? items[0] : null

  const { data: sale, error: saleError } = await supabase
    .from('sales')
    .insert({
      organization_id: org.id,
      contato_id: contatoId,
      product_id: singleItem?.product_id ?? null,
      seller_id: user.id,
      sale_date: new Date().toISOString().slice(0, 10),
      quantity: singleItem?.quantity ?? 1,
      amount_cents: totalCents,
      status: 'completed',
    })
    .select('id')
    .single()

  if (saleError || !sale) return { ok: false as const, error: saleError?.message || 'Erro ao registrar venda' }

  const saleItemRows = items.map(it => ({
    organization_id: org.id,
    sale_id: sale.id,
    product_id: it.product_id,
    name: (it.products as any)?.name || 'Item removido do catálogo',
    description: (it.products as any)?.description || null,
    unit_price_cents: it.unit_price_cents,
    quantity: it.quantity,
    is_recurring: (it.products as any)?.is_recurring || false,
    duration_months: (it.products as any)?.duration_months || null,
  }))

  const { error: snapshotError } = await supabase.from('sale_items').insert(saleItemRows)
  if (snapshotError) {
    // A venda já foi criada — não desfaz (o registro comercial em si é
    // válido), só reporta que o detalhamento por item falhou.
    return { ok: false as const, error: `Venda registrada, mas falhou ao salvar o detalhamento dos itens: ${snapshotError.message}`, saleId: sale.id }
  }

  // Mesmo evento de automação que createSale() já dispara — reaproveitado,
  // não duplicado.
  await inngest.send({ name: 'sale.registered', data: { orgId: org.id, leadId: contatoId } })

  revalidatePath(`/app/${orgSlug}/vendas`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const, saleId: sale.id }
}
