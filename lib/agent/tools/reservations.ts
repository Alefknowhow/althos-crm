import { z } from 'zod'
import { createTravelSaleCore } from '@/lib/services/travel-sales-create'
import { updateTravelSaleCore, deleteTravelSaleCore } from '@/lib/services/travel-sales-crud'
import { define, id, text, money, date, pagination, actionContext, record, unwrap, list, requireModule } from './crm-shared'

const patch = z.object({
  destination: text.nullable().optional(), departure_date: date.nullable().optional(), return_date: date.nullable().optional(),
  total_cents: money.optional(), commission_cents: money.optional(), retained_commission_cents: money.nullable().optional(),
  hotel_name: text.nullable().optional(), airline: text.nullable().optional(), operator: text.nullable().optional(),
  payment_method: text.nullable().optional(), package_locator: text.nullable().optional(), air_locator: text.nullable().optional(), hotel_locator: text.nullable().optional(),
  notes: text.nullable().optional(), travelers_note: text.nullable().optional(), cancellation_policy: text.nullable().optional(),
  important_info: text.nullable().optional(), service_info: text.nullable().optional(), included_items: z.array(text).max(100).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Informe ao menos um campo.')

async function reservationPreview(ctx: Parameters<typeof record>[0], input: { id: string; patch: z.infer<typeof patch> }) {
  requireModule(ctx, 'financial')
  const current = await record(ctx, 'travel_sales', input.id)
  const next = { ...current, ...input.patch }
  if (next.departure_date && next.return_date && next.return_date < next.departure_date) throw new Error('Retorno anterior ao embarque.')
  if ((next.retained_commission_cents ?? 0) > (next.commission_cents ?? 0)) throw new Error('Comissão retida maior que a comissão total.')
  return { record: current, changes: input.patch, effects: 'As comissões pendentes no financeiro serão sincronizadas conforme as regras da operadora.' }
}

export const reservationTools = [
  define('get_reservations', 'Lista reservas de viagem, com filtros e paginação.', 'reservas', { ...pagination, search: text.optional(), startDate: date.optional(), endDate: date.optional() }, 'read',
    (ctx, input) => list(ctx, 'travel_sales', 'id,sale_number,client_name,contato_id,status,destination,departure_date,return_date,total_cents,commission_cents,created_at,updated_at', input, 'created_at', 'client_name')),
  define('get_reservation', 'Consulta os detalhes de uma reserva de viagem.', 'reservas', { id }, 'read', (ctx, input) => record(ctx, 'travel_sales', input.id)),
  define('create_reservation', 'Cria uma reserva em aberto vinculada a um contato, opcionalmente preenchida a partir de uma proposta. Dispara as automações de nova reserva.', 'reservas', { contactId: id, proposalId: id.optional() }, 'create',
    async (ctx, input) => { await record(ctx, 'contatos', input.contactId); if (input.proposalId) { requireModule(ctx, 'cotacoes'); await record(ctx, 'travel_proposals', input.proposalId) } return unwrap(await createTravelSaleCore(await actionContext(ctx), input.proposalId, input.contactId)) }),
  define('update_reservation', 'Edita dados da reserva e sincroniza comissões no financeiro. Exige acesso a reservas e financeiro.', 'reservas', { id, patch }, 'change',
    async (ctx, input) => { const preview = await reservationPreview(ctx, input); return unwrap(await updateTravelSaleCore(await actionContext(ctx), input.id, { ...input.patch, commission_cents: input.patch.commission_cents ?? preview.record.commission_cents })) }, reservationPreview),
  define('delete_reservation', 'Exclui uma reserva e seus dados dependentes. Restrito a administradores.', 'reservas', { id }, 'change',
    async (ctx, input) => { if (ctx.role === 'member') throw new Error('Exclusão com dependências exige administrador.'); await record(ctx, 'travel_sales', input.id); return unwrap(await deleteTravelSaleCore(await actionContext(ctx), input.id)) },
    async (ctx, input) => { if (ctx.role === 'member') throw new Error('Exclusão com dependências exige administrador.'); return { record: await record(ctx, 'travel_sales', input.id), effects: 'A reserva e seus registros dependentes serão excluídos conforme as relações do CRM. Não equivale a cancelar com geração de crédito. Lançamentos financeiros podem perder o vínculo com a reserva.' } }),
]
