'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { REAL_ESTATE_PIPELINE_KIND, REAL_ESTATE_PIPELINE_STAGES } from '@/lib/pipeline-imoveis-constants'

/**
 * Pipeline imobiliário (Vertical Imobiliárias, Fase 7) — ver
 * supabase/migrations/0183_pipeline_kind.sql. Reaproveita 100% o Core de
 * pipelines múltiplos (pipelines/pipeline_stages, KanbanBoard,
 * PipelineSwitcher) — a única peça nova é `pipelines.kind`, que marca
 * qual pipeline é "o de imóveis" pra automação encontrar sem depender de
 * nome digitado pelo usuário.
 */

/**
 * Get-or-create idempotente: garante que a org tenha um pipeline
 * `kind='imoveis'` com as etapas padrão, e devolve o id. Chamada
 * preguiçosamente pela rota /pipeline-imoveis — sem migração de dado
 * pra orgs existentes.
 */
export async function ensureRealEstatePipeline(orgSlug: string): Promise<{ id: string }> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'imoveis')
  if (!perm.allowed) throw new Error(perm.reason || 'Sem permissão')

  const supabase = createClient()

  const { data: existing } = await supabase
    .from('pipelines')
    .select('id')
    .eq('organization_id', org.id)
    .eq('kind', REAL_ESTATE_PIPELINE_KIND)
    .maybeSingle()
  if (existing) return { id: existing.id }

  const { data: pipeline, error } = await supabase
    .from('pipelines')
    .insert({ organization_id: org.id, name: 'Pipeline Imobiliário', kind: REAL_ESTATE_PIPELINE_KIND, is_default: false })
    .select('id')
    .single()
  if (error || !pipeline) throw new Error(error?.message || 'Erro ao criar o pipeline imobiliário')

  const { error: stagesError } = await supabase.from('pipeline_stages').insert(
    REAL_ESTATE_PIPELINE_STAGES.map((s, i) => ({
      pipeline_id: pipeline.id,
      name: s.name,
      position: i,
      is_won: s.is_won ?? false,
      is_lost: s.is_lost ?? false,
    })),
  )
  if (stagesError) throw new Error(stagesError.message)

  return { id: pipeline.id }
}
