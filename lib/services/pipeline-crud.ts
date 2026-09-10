// Internal services: callers must supply an authenticated, organization-scoped context.
import { isAccessBlocked } from '@/lib/billing/plans'
import { revalidatePath } from 'next/cache'
import type { ActionContext } from './context'
const FROZEN_ERROR = 'Conta em modo somente leitura (teste expirado ou assinatura cancelada). Assine um plano para continuar editando.'
export async function createPipelineCore(ctx: ActionContext, name: string) {
  const orgSlug = ctx.org.slug
  const { org, allowed, reason } = { org: ctx.org, ...(await ctx.checkPermission(['pipeline'])) }
  if (!allowed) return { ok: false as const, error: reason || 'Sem permissão' }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = ctx.supabase

  const trimmed = (name || '').trim()
  if (trimmed.length < 2) return { ok: false as const, error: 'Nome muito curto' }

  // First pipeline of the org becomes default automatically.
  const { count: existing } = await supabase
    .from('pipelines')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', org.id)

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({
      organization_id: org.id,
      name: trimmed,
      is_default: (existing || 0) === 0,
    })
    .select('id')
    .maybeSingle()

  if (error || !pipeline) {
    console.error('createPipeline error:', error)
    return { ok: false as const, error: error?.message || 'Erro ao criar pipeline' }
  }

  // Seed with 3 sensible default stages so the user can start using it immediately.
  const seedStages = [
    { name: 'Novo', position: 1, color: '#3b82f6' },
    { name: 'Em contato', position: 2, color: '#f59e0b' },
    { name: 'Ganho', position: 3, color: '#10b981' },
  ]
  await supabase
    .from('pipeline_stages')
    .insert(seedStages.map(s => ({ ...s, pipeline_id: pipeline.id })))

  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const, pipelineId: pipeline.id }
}

export async function renamePipelineCore(ctx: ActionContext, pipelineId: string, name: string) {
  const orgSlug = ctx.org.slug
  const { org, allowed, reason } = { org: ctx.org, ...(await ctx.checkPermission(['pipeline'])) }
  if (!allowed) return { ok: false as const, error: reason || 'Sem permissão' }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = ctx.supabase

  const trimmed = (name || '').trim()
  if (trimmed.length < 2) return { ok: false as const, error: 'Nome muito curto' }

  const { error } = await supabase
    .from('pipelines')
    .update({ name: trimmed })
    .eq('id', pipelineId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}

export async function deletePipelineCore(ctx: ActionContext, pipelineId: string) {
  const orgSlug = ctx.org.slug
  if (ctx.impersonating) {
    return { ok: false as const, error: 'Ações destrutivas não são permitidas em modo de impersonação.' }
  }
  const { org, allowed, reason } = { org: ctx.org, ...(await ctx.checkPermission(['pipeline'])) }
  if (!allowed) return { ok: false as const, error: reason || 'Sem permissão' }
  if (isAccessBlocked(org as any)) return { ok: false as const, error: FROZEN_ERROR }
  const supabase = ctx.supabase

  // Refuse to delete the default; user must promote another pipeline first.
  const { data: pipeline } = await supabase
    .from('pipelines')
    .select('id, is_default')
    .eq('id', pipelineId)
    .eq('organization_id', org.id)
    .maybeSingle()

  if (!pipeline) return { ok: false as const, error: 'Pipeline não encontrado' }
  if (pipeline.is_default) {
    return { ok: false as const, error: 'Não é possível excluir o pipeline padrão. Defina outro como padrão antes.' }
  }

  // Refuse if there are leads — user has to migrate them first to avoid silent data loss.
  const { count } = await supabase
    .from('contatos')
    .select('id', { count: 'exact', head: true })
    .eq('pipeline_id', pipelineId)
    .eq('organization_id', org.id)

  if (count && count > 0) {
    return {
      ok: false as const,
      error: `Pipeline possui ${count} lead(s). Mova-os antes de excluir.`,
    }
  }

  const { error } = await supabase
    .from('pipelines')
    .delete()
    .eq('id', pipelineId)
    .eq('organization_id', org.id)

  if (error) return { ok: false as const, error: error.message }
  revalidatePath(`/app/${orgSlug}/configuracoes/pipelines`)
  revalidatePath(`/app/${orgSlug}/pipeline`)
  return { ok: true as const }
}
