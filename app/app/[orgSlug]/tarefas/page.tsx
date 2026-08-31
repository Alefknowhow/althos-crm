import { getCurrentOrganization, requireAuth } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { listOrgMembers } from '@/actions/team'
import TaskDialog from '@/components/features/TaskDialog'
import TasksBoard from '@/components/features/tasks/TasksBoard'
import { PageHeader } from '@/components/ui/page-header'
import { Plus } from 'lucide-react'

const RELATED_LABELS: Record<string, string> = {
  travel_proposal: 'Cotação',
  appointment: 'Agendamento',
  sale: 'Venda',
  property_deal: 'Negócio imobiliário',
  property_proposal: 'Proposta imobiliária',
}

export default async function TasksPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const user = await requireAuth()
  const supabase = createClient()

  // Pull every active-workflow task; classificação em Atrasadas/Hoje/Próximas/
  // Concluídas é derivada client-side de status+due_date (TasksBoard.tsx).
  // Limit(1000) trava um teto — antes carregava a tabela inteira sem limite.
  const [{ data: tasks }, members] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, description, status, priority, due_date, completed_at, created_at, assigned_to, column_id, sale_id, related_entity_type, related_entity_id, leads:contatos(id, name)')
      .eq('organization_id', org.id)
      .order('due_date', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1000),
    listOrgMembers(params.orgSlug),
  ])

  const memberName = new Map(members.map(m => [m.user_id, m.name]))
  const rows = (tasks || []) as any[]

  // Resolve labels de exibição pra sale_id (reserva) e related_entity_*
  // (cotação/agendamento/venda/negócio e proposta imobiliária) — batch por
  // tabela via .in(), mesmo padrão usado em app/[orgSlug]/contatos/page.tsx.
  const saleIds = Array.from(new Set(rows.filter(r => r.sale_id).map(r => r.sale_id)))
  const saleLabel = new Map<string, string>()
  if (saleIds.length > 0) {
    const { data } = await supabase.from('travel_sales').select('id, client_name, destination, sale_number').in('id', saleIds)
    for (const s of data || []) {
      saleLabel.set(s.id, s.sale_number ? `#${s.sale_number} — ${s.client_name || s.destination || ''}` : (s.client_name || s.destination || 'Reserva'))
    }
  }

  const idsByType: Record<string, string[]> = {}
  for (const r of rows) {
    if (r.related_entity_type && r.related_entity_id) {
      (idsByType[r.related_entity_type] ??= []).push(r.related_entity_id)
    }
  }

  const relatedLabel = new Map<string, string>() // key: `${type}:${id}`

  async function contatoNamesFor(ids: string[]) {
    if (ids.length === 0) return new Map<string, string>()
    const { data } = await supabase.from('contatos').select('id, name').in('id', Array.from(new Set(ids)))
    return new Map((data || []).map((c: any) => [c.id, c.name]))
  }

  if (idsByType.travel_proposal?.length) {
    const { data } = await supabase.from('travel_proposals').select('id, title, client_name').in('id', Array.from(new Set(idsByType.travel_proposal)))
    for (const p of data || []) relatedLabel.set(`travel_proposal:${p.id}`, [p.title, p.client_name].filter(Boolean).join(' — ') || 'Cotação')
  }
  if (idsByType.appointment?.length) {
    const { data } = await supabase.from('appointments').select('id, guest_name, start_time').in('id', Array.from(new Set(idsByType.appointment)))
    for (const a of data || []) relatedLabel.set(`appointment:${a.id}`, `${a.guest_name || 'Agendamento'}${a.start_time ? ' — ' + new Date(a.start_time).toLocaleDateString('pt-BR') : ''}`)
  }
  if (idsByType.sale?.length) {
    const ids = Array.from(new Set(idsByType.sale))
    const { data } = await supabase.from('sales').select('id, amount_cents, contato_id').in('id', ids)
    const names = await contatoNamesFor((data || []).map((s: any) => s.contato_id))
    for (const s of data || []) relatedLabel.set(`sale:${s.id}`, `${names.get(s.contato_id) || 'Venda'} — R$ ${((s.amount_cents || 0) / 100).toFixed(2)}`)
  }
  if (idsByType.property_deal?.length) {
    const ids = Array.from(new Set(idsByType.property_deal))
    const { data } = await supabase.from('property_deals').select('id, deal_type, contato_id').in('id', ids)
    const names = await contatoNamesFor((data || []).map((d: any) => d.contato_id))
    for (const d of data || []) relatedLabel.set(`property_deal:${d.id}`, `${names.get(d.contato_id) || 'Negócio'} (${d.deal_type === 'locacao' ? 'Locação' : 'Venda'})`)
  }
  if (idsByType.property_proposal?.length) {
    const ids = Array.from(new Set(idsByType.property_proposal))
    const { data } = await supabase.from('property_proposals').select('id, operation_type, contato_id').in('id', ids)
    const names = await contatoNamesFor((data || []).map((p: any) => p.contato_id))
    for (const p of data || []) relatedLabel.set(`property_proposal:${p.id}`, `${names.get(p.contato_id) || 'Proposta'} (${p.operation_type === 'locacao' ? 'Locação' : 'Venda'})`)
  }

  // Supabase types the joined `leads` as an array; normalise to a single object.
  const normalized = rows.map((t: any) => {
    let related: { type: string; label: string } | null = null
    if (t.leads) related = { type: 'contato', label: t.leads.name }
    else if (t.sale_id) related = { type: 'reserva', label: saleLabel.get(t.sale_id) || 'Reserva' }
    else if (t.related_entity_type && t.related_entity_id) {
      related = { type: t.related_entity_type, label: relatedLabel.get(`${t.related_entity_type}:${t.related_entity_id}`) || RELATED_LABELS[t.related_entity_type] || 'Relacionado' }
    }
    return {
      ...t,
      leads: Array.isArray(t.leads) ? (t.leads[0] ?? null) : (t.leads ?? null),
      assignee_name: t.assigned_to ? (memberName.get(t.assigned_to) ?? null) : null,
      related,
    }
  })

  return (
    <div className="pt-3 space-y-6">
      <PageHeader
        title="Tarefas"
        hint="Calendário e lista sincronizados — Atrasadas, Hoje, Próximas e Concluídas."
      />

      <TasksBoard
        initialTasks={normalized as any}
        orgSlug={params.orgSlug}
        members={members}
        currentUserId={user.id}
        niche={org.niche}
      />

      {/* FAB mobile — mesma criação de tarefa do botão do cabeçalho (desktop),
          só que ancorada no canto inferior direito, acima da bottom nav. */}
      <div className="md:hidden fixed bottom-20 right-4 z-30">
        <TaskDialog
          orgSlug={params.orgSlug}
          members={members}
          niche={org.niche}
          trigger={
            <button
              type="button"
              aria-label="Nova tarefa"
              className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:scale-95 transition-transform"
            >
              <Plus className="w-6 h-6" />
            </button>
          }
        />
      </div>
    </div>
  )
}
