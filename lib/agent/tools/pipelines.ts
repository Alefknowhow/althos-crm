import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { createPipelineCore, renamePipelineCore, deletePipelineCore } from '@/lib/services/pipeline-crud'
import { createStageCore, updateStageCore, deleteStageCore } from '@/lib/services/pipeline-stages'
import { moveLeadToStageCore } from '@/lib/services/contatos-pipeline'
import { define, id, text, money, pagination, actionContext, record, unwrap, requireModule } from './crm-shared'

const stagePatch = z.object({ name: text.min(2).optional(), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional(), is_won: z.boolean().optional(), is_lost: z.boolean().optional() }).strict()
  .refine(v => Object.keys(v).length > 0 && !(v.is_won && v.is_lost), 'Informe uma alteração válida; ganho e perdido são exclusivos.')
const moveShape = { contactId: id, stageId: id, value_cents: money.optional(), closeInfo: z.object({ dealStatus: z.enum(['perdido','desqualificado']), reason: text.min(1) }).strict().optional() }
async function movePreview(ctx: Parameters<typeof record>[0], input: z.infer<z.ZodObject<typeof moveShape>>) {
  const contact = await record(ctx, 'contatos', input.contactId)
  const stage = await record(ctx, 'pipeline_stages', input.stageId)
  if (stage.pipeline_id !== contact.pipeline_id) throw new Error('A etapa deve pertencer ao pipeline atual do contato.')
  if (stage.is_won) requireModule(ctx, 'reservas')
  return { record: contact, destinationStage: stage, changes: input, effects: 'Atualiza o negócio, o status do contato e dispara automações de mudança de etapa. Ganho pode criar reserva e disparar eventos de conversão; perda pode disparar eventos de desqualificação.' }
}

export const pipelineTools = [
  define('get_pipelines', 'Lista pipelines e etapas com IDs para criação e movimentação de contatos.', 'pipeline', {}, 'read', async ctx => {
    const { data, error } = await createAdminClient().from('pipelines').select('id,name,is_default,kind,pipeline_stages(id,name,position,is_won,is_lost,color)').eq('organization_id', ctx.orgId).order('created_at')
    if (error) throw new Error(error.message)
    return data
  }),
  define('get_pipeline_contacts', 'Lista oportunidades representadas pelos contatos do pipeline, com etapa e valores.', 'pipeline', { pipelineId: id, ...pagination }, 'read', async (ctx, input) => {
    await record(ctx, 'pipelines', input.pipelineId)
    const { data, error, count } = await createAdminClient().from('contatos').select('id,name,stage_id,value_cents,deal_status,assigned_to,updated_at', { count: 'exact' }).eq('organization_id', ctx.orgId).eq('pipeline_id', input.pipelineId).order('id').range(input.offset, input.offset + input.limit - 1)
    if (error) throw new Error(error.message)
    return { records: data, total: count }
  }),
  define('create_pipeline', 'Cria pipeline com as etapas iniciais padrão do CRM.', 'pipeline', { name: text.min(2) }, 'create', async (ctx, input) => unwrap(await createPipelineCore(await actionContext(ctx), input.name))),
  define('update_pipeline', 'Renomeia um pipeline.', 'pipeline', { id, name: text.min(2) }, 'change', async (ctx, input) => unwrap(await renamePipelineCore(await actionContext(ctx), input.id, input.name)), async (ctx, input) => ({ record: await record(ctx, 'pipelines', input.id), changes: { name: input.name } })),
  define('delete_pipeline', 'Exclui pipeline vazio que não seja o padrão, seguindo as regras do CRM.', 'pipeline', { id }, 'change', async (ctx, input) => unwrap(await deletePipelineCore(await actionContext(ctx), input.id)), async (ctx, input) => ({ record: await record(ctx, 'pipelines', input.id), effects: 'Exclui o pipeline e suas etapas. A operação será recusada se houver contatos ou se for o pipeline padrão.' })),
  define('create_pipeline_stage', 'Cria uma etapa ao final do pipeline.', 'pipeline', { pipelineId: id, name: text.min(2), color: z.string().regex(/^#[0-9a-f]{6}$/i).optional() }, 'create', async (ctx, input) => unwrap(await createStageCore(await actionContext(ctx), input.pipelineId, input.name, input.color))),
  define('update_pipeline_stage', 'Edita nome, cor ou classificação de ganho/perda de uma etapa.', 'pipeline', { id, patch: stagePatch }, 'change', async (ctx, input) => unwrap(await updateStageCore(await actionContext(ctx), input.id, input.patch)), async (ctx, input) => ({ record: await record(ctx, 'pipeline_stages', input.id), changes: input.patch })),
  define('delete_pipeline_stage', 'Exclui uma etapa sem contatos.', 'pipeline', { id }, 'change', async (ctx, input) => unwrap(await deleteStageCore(await actionContext(ctx), input.id)), async (ctx, input) => ({ record: await record(ctx, 'pipeline_stages', input.id), effects: 'Exclui a etapa. Recusa se houver contatos vinculados.' })),
  define('move_pipeline_contact', 'Move uma oportunidade/contato para outra etapa do mesmo pipeline, preservando histórico e automações.', 'pipeline', moveShape, 'change', async (ctx, input) => {
    const preview = await movePreview(ctx, input)
    return unwrap(await moveLeadToStageCore(await actionContext(ctx), input.contactId, input.stageId, preview.record.stage_id, input.closeInfo, input.value_cents))
  }, movePreview),
]
