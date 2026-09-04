'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { pick, type TravelSaleRow } from './travel-sales-shared'


// Tarefas geradas automaticamente (checklist flat legado) são de dia
// inteiro — sem horário — igual ao gerador por produto em
// lib/reservas/task-templates.ts. Ver o comentário lá pro porquê do
// T00:00:00.000Z em vez de T12:00:00.
function shiftDate(dateStr: string, deltaDays: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + deltaDays)
  return `${d.toISOString().slice(0, 10)}T00:00:00.000Z`
}

/**
 * Save the sale and (idempotently) generate the operational checklist tasks:
 *  - Check-in do voo (ida)  → 1 dia antes da partida
 *  - Check-in do voo (volta)→ 1 dia antes do retorno
 *  - Contatar hotel + e-mail→ 5 dias antes da partida
 *  - Enviar briefing cliente→ 5 dias antes da partida
 */
export async function saveTravelSaleAndGenerateTasks(orgSlug: string, id: string, input: Record<string, any>) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'reservas')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { data: sale, error } = await supabase
    .from('travel_sales')
    .update(pick(input))
    .eq('id', id)
    .eq('organization_id', org.id)
    .select()
    .single()

  if (error || !sale) return { ok: false as const, error: error?.message || 'Erro ao salvar venda' }
  const s = sale as TravelSaleRow

  // Lança/atualiza a receita de comissão em Financeiro na data de pagamento
  // da operadora (não no dia da venda) — sem operadora/comissão, não faz nada.
  const { syncSaleRevenueEntry } = await import('@/actions/financial')
  await syncSaleRevenueEntry(orgSlug, {
    id: s.id, contato_id: s.contato_id, client_name: s.client_name,
    operator: s.operator, commission_cents: s.commission_cents ?? null,
    retained_commission_cents: s.retained_commission_cents ?? null,
    created_at: s.created_at,
  })

  if (s.tasks_generated_at) {
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, data: s, tasksCreated: 0, alreadyGenerated: true }
  }

  // Vendas com produtos estruturados geram tarefas pela tela de "Tarefas
  // sugeridas" (por produto, ver lib/reservas/task-templates.ts) em vez do
  // checklist flat abaixo — que fica só como fallback pra vendas legadas
  // sem nenhum sale_product.
  const { count: productCount } = await supabase
    .from('sale_products')
    .select('id', { count: 'exact', head: true })
    .eq('sale_id', id)
  if ((productCount || 0) > 0) {
    revalidatePath(`/app/${orgSlug}/reservas`)
    return { ok: true as const, data: s, tasksCreated: 0, alreadyGenerated: false, hasProducts: true }
  }

  const client = s.client_name || 'cliente'
  const tasks: { title: string; description: string; due_date: string; priority: string }[] = []

  if (s.departure_date) {
    const checkinInfo = [
      s.air_locator ? `Localizador aéreo: ${s.air_locator}` : null,
      s.airline ? `Cia aérea: ${s.airline}` : null,
    ].filter(Boolean).join('\n')

    tasks.push({
      title: `✈️ Check-in do voo (ida) — ${client}`,
      description: checkinInfo || 'Realizar check-in do voo de ida.',
      due_date: shiftDate(s.departure_date, -1),
      priority: 'high',
    })
    tasks.push({
      title: `🏨 Contatar hotel e enviar e-mail de confirmação — ${client}`,
      description: [
        s.hotel_name ? `Hotel: ${s.hotel_name}` : null,
        s.package_locator ? `Localizador do pacote: ${s.package_locator}` : null,
        'Confirmar reserva com o hotel e enviar e-mail ao cliente.',
      ].filter(Boolean).join('\n'),
      due_date: shiftDate(s.departure_date, -5),
      priority: 'normal',
    })
    tasks.push({
      title: `📋 Enviar briefing ao cliente — ${client}`,
      description: [
        s.destination ? `Destino: ${s.destination}` : null,
        'Enviar o briefing de viagem (documentos, orientações, roteiro) ao cliente.',
      ].filter(Boolean).join('\n'),
      due_date: shiftDate(s.departure_date, -5),
      priority: 'normal',
    })
  }

  if (s.return_date) {
    const checkinInfo = [
      s.air_locator ? `Localizador aéreo: ${s.air_locator}` : null,
      s.airline ? `Cia aérea: ${s.airline}` : null,
    ].filter(Boolean).join('\n')
    tasks.push({
      title: `✈️ Check-in do voo (volta) — ${client}`,
      description: checkinInfo || 'Realizar check-in do voo de volta.',
      due_date: shiftDate(s.return_date, -1),
      priority: 'high',
    })
  }

  let tasksCreated = 0
  if (tasks.length > 0) {
    const { error: tErr } = await supabase.from('tasks').insert(
      tasks.map(t => ({
        organization_id: org.id,
        contato_id: s.contato_id,
        sale_id: id,
        title: t.title,
        description: t.description,
        due_date: t.due_date,
        priority: t.priority,
        status: 'open',
        created_by: user.id,
        assigned_to: user.id,
      }))
    )
    if (tErr) return { ok: false as const, error: `Venda salva, mas falhou ao criar tarefas: ${tErr.message}` }
    tasksCreated = tasks.length

    await supabase
      .from('travel_sales')
      .update({ tasks_generated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('organization_id', org.id)
  }

  revalidatePath(`/app/${orgSlug}/reservas`)
  revalidatePath(`/app/${orgSlug}/tarefas`)
  return { ok: true as const, data: s, tasksCreated, alreadyGenerated: false }
}
