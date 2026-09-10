import { z } from 'zod'
import { createFinancialEntryCore, updateFinancialEntryCore, deleteFinancialEntryCore } from '@/lib/services/financial-entries'
import { define, id, text, money, date, pagination, actionContext, record, unwrap, list, requireModule } from './crm-shared'

const fields = {
  tipo: z.enum(['receita', 'despesa']), categoria: text.min(1), valor_cents: money.min(1), competencia: date,
  status: z.enum(['pendente', 'pago', 'vencido', 'cancelado']).optional(),
  vencimento: date.nullable().optional(), data_pagamento: date.nullable().optional(), contato_id: id.nullable().optional(),
  subcategoria: text.nullable().optional(), centro_custo: text.nullable().optional(), conta_bancaria: text.nullable().optional(), forma_pagamento: text.nullable().optional(),
  operadora: text.nullable().optional(), observacoes: text.nullable().optional(), tags: z.array(text.max(100)).max(50).optional(),
  nota_fiscal: text.nullable().optional(), numero_documento: text.nullable().optional(), projeto: text.nullable().optional(), unidade_negocio: text.nullable().optional(),
}
const patch = z.object(fields).partial().strict().refine(v => Object.keys(v).length > 0, 'Informe ao menos um campo.')
async function validateContact(ctx: Parameters<typeof record>[0], input: { contato_id?: string | null }) {
  if (input.contato_id) { requireModule(ctx, 'clients'); await record(ctx, 'contatos', input.contato_id) }
}
export const financeTools = [
  define('get_financial_entries', 'Consulta lançamentos financeiros, com período de competência, status e paginação. Valores em centavos.', 'financial',
    { ...pagination, startDate: date.optional(), endDate: date.optional(), status: z.enum(['pendente', 'pago', 'vencido', 'cancelado']).optional() }, 'read',
    (ctx, input) => list(ctx, 'financial_entries', 'id,tipo,categoria,valor_cents,competencia,vencimento,data_pagamento,status,contato_id,observacoes,created_at,updated_at', input, 'competencia')),
  define('get_financial_entry', 'Consulta um lançamento financeiro completo.', 'financial', { id }, 'read', (ctx, input) => record(ctx, 'financial_entries', input.id)),
  define('create_financial_entry', 'Cria um lançamento individual de receita ou despesa; valores em centavos. Não cria recorrência ou parcelamento.', 'financial', fields, 'create',
    async (ctx, input) => { await validateContact(ctx, input); return unwrap(await createFinancialEntryCore(await actionContext(ctx), input)) }),
  define('update_financial_entry', 'Edita somente o lançamento identificado, sem editar outras parcelas ou a recorrência inteira.', 'financial', { id, patch }, 'change',
    async (ctx, input) => { await validateContact(ctx, input.patch); await record(ctx, 'financial_entries', input.id); return unwrap(await updateFinancialEntryCore(await actionContext(ctx), input.id, input.patch)) },
    async (ctx, input) => { await validateContact(ctx, input.patch); return { record: await record(ctx, 'financial_entries', input.id), changes: input.patch } }),
  define('delete_financial_entry', 'Exclui somente o lançamento identificado e os anexos dele; não exclui outras parcelas.', 'financial', { id }, 'change',
    async (ctx, input) => { await record(ctx, 'financial_entries', input.id); return unwrap(await deleteFinancialEntryCore(await actionContext(ctx), input.id)) },
    async (ctx, input) => ({ record: await record(ctx, 'financial_entries', input.id), effects: 'O lançamento e seus anexos serão excluídos. Outras parcelas não serão alteradas.' })),
]
