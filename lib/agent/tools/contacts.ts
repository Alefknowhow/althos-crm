import { z } from 'zod'
import { createLeadCore, updateLeadCore, deleteLeadCore } from '@/lib/services/contatos-leads'
import { define, id, text, money, date, pagination, actionContext, record, unwrap, form, list, requireModule } from './crm-shared'

const fields = {
  name: text.min(2), email: z.union([z.email(), z.literal('')]).optional(), phone: text.optional(),
  tags: z.array(text.max(100)).max(50).optional(),
}
const patch = z.object({ ...fields, cpf: text.optional(), date_of_birth: date.nullable().optional(), internal_notes: text.nullable().optional() }).partial().strict().refine(v => Object.keys(v).length > 0, 'Informe ao menos um campo.')

export const contactTools = [
  define('get_contacts', 'Lista contatos (leads, clientes e inativos), com busca por nome e paginação.', 'clients', { ...pagination, search: text.optional(), status: z.enum(['lead', 'cliente', 'inativo']).optional() }, 'read',
    (ctx, input) => list(ctx, 'contatos', 'id,name,email,phone,status,tags,pipeline_id,stage_id,value_cents,created_at,updated_at', input, 'created_at', 'name')),
  define('get_contact', 'Consulta cadastro e informações de um contato pelo ID.', 'clients', { id }, 'read',
    (ctx, input) => record(ctx, 'contatos', input.id, 'id,name,email,phone,status,tags,cpf,date_of_birth,city,state,country,street,postal_code,internal_notes,pipeline_id,stage_id,value_cents,created_at,updated_at')),
  define('create_contact', 'Cria contato com negócio no pipeline e distribuição conforme as regras do CRM. Informe a etapa obtida em get_pipelines.', 'clients',
    { ...fields, stage_id: id, value_cents: money.default(0) }, 'create', async (ctx, input) => {
      requireModule(ctx, 'pipeline')
      await record(ctx, 'pipeline_stages', input.stage_id)
      return unwrap(await createLeadCore(await actionContext(ctx), form({ email: '', phone: '', ...input })))
    }),
  define('update_contact', 'Edita os campos informados de um contato. Não muda etapa do pipeline.', 'clients', { id, patch }, 'change',
    async (ctx, input) => { await record(ctx, 'contatos', input.id); return unwrap(await updateLeadCore(await actionContext(ctx), input.id, form(input.patch))) },
    async (ctx, input) => ({ record: await record(ctx, 'contatos', input.id, 'id,name,email,phone,tags,cpf,date_of_birth,internal_notes,updated_at'), changes: input.patch, effects: 'Tags adicionadas podem disparar automações do CRM.' })),
  define('delete_contact', 'Exclui o contato e os dados dependentes conforme as relações do CRM. Restrito a administradores.', 'clients', { id }, 'change',
    async (ctx, input) => { if (ctx.role === 'member') throw new Error('Exclusão com dependências exige administrador.'); await record(ctx, 'contatos', input.id); return unwrap(await deleteLeadCore(await actionContext(ctx), input.id)) },
    async (ctx, input) => { if (ctx.role === 'member') throw new Error('Exclusão com dependências exige administrador.'); return { record: await record(ctx, 'contatos', input.id, 'id,name,email,phone,updated_at'), effects: 'O contato será excluído. Histórico, negócios e outros registros dependentes podem ser excluídos em cascata; vínculos em reservas e financeiro podem ser removidos.' } }),
]
