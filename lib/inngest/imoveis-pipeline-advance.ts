import { inngest } from './client'
import { createAdminClient } from '../supabase/server'
import { REAL_ESTATE_PIPELINE_KIND } from '@/lib/pipeline-imoveis-constants'

/**
 * Avanço automático do Pipeline Imobiliário (Fase 7) — escuta os MESMOS
 * eventos já emitidos por scheduleVisit/updateVisitStatus/closeDeal
 * (Fases 2-3), em paralelo ao motor de automação genérico
 * (lib/inngest/automation.ts), sem duplicar/substituir nada dele.
 *
 * Deliberadamente NÃO reaproveita o corpo completo de
 * actions/contatos.ts::moveLeadToStage (CAPI, auto-criação de venda de
 * viagem, espelho em `negocios`) — essa function é o caminho principal de
 * drag-and-drop usado por TODAS as verticais, e replicar seus efeitos
 * colaterais num contexto de sistema (sem usuário autenticado) é risco
 * desnecessário pra um avanço "de cortesia". Aqui só se faz o mínimo pra
 * manter o board coerente: mover stage_id, refletir deal_status (que é o
 * que tira/mantém o lead no board — ver pipeline/page.tsx) e registrar a
 * atividade.
 */

const STAGE_BY_EVENT: Record<string, string> = {
  'imoveis.visit.scheduled': 'Visita agendada',
  'imoveis.visit.completed': 'Visita realizada',
  'imoveis.proposal.sent': 'Proposta enviada',
  'imoveis.deal.closed': 'Fechado',
}

export const imoveisPipelineAdvanceFn = inngest.createFunction(
  {
    id: 'imoveis-pipeline-advance',
    concurrency: { key: 'event.data.orgId', limit: 5 },
    triggers: [
      { event: 'imoveis.visit.scheduled' },
      { event: 'imoveis.visit.completed' },
      { event: 'imoveis.proposal.sent' },
      { event: 'imoveis.deal.closed' },
    ],
  },
  async ({ event, step }: { event: any; step: any }) => {
    const { orgId, leadId } = event.data as { orgId: string; leadId: string | undefined }
    const targetStageName = STAGE_BY_EVENT[event.name as string]
    if (!orgId || !leadId || !targetStageName) return { skipped: 'missing_data' }

    const supabase = createAdminClient()

    const moved = await step.run('advance-stage', async () => {
      const { data: pipeline } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', orgId)
        .eq('kind', REAL_ESTATE_PIPELINE_KIND)
        .maybeSingle()
      if (!pipeline) return { skipped: 'no_pipeline' }

      const { data: contato } = await supabase
        .from('contatos')
        .select('id, pipeline_id, stage_id')
        .eq('id', leadId)
        .eq('organization_id', orgId)
        .maybeSingle()
      // Só avança leads que já estão DENTRO do pipeline imobiliário — entrada
      // continua manual (arrastar/selecionar), por design (ver plano).
      if (!contato || contato.pipeline_id !== pipeline.id) return { skipped: 'not_in_pipeline' }

      const { data: stages } = await supabase
        .from('pipeline_stages')
        .select('id, name, position, is_won, is_lost')
        .eq('pipeline_id', pipeline.id)
        .order('position')
      if (!stages) return { skipped: 'no_stages' }

      const currentStage = stages.find(s => s.id === contato.stage_id)
      const targetStage = stages.find(s => s.name === targetStageName)
      if (!targetStage) return { skipped: 'unknown_target_stage' }
      if (targetStage.id === contato.stage_id) return { skipped: 'already_there' }

      // Nunca regride etapa, exceto o evento terminal (negócio fechado),
      // que sempre força "Fechado" mesmo se o lead já tivesse avançado além.
      const isTerminal = targetStage.is_won || targetStage.is_lost
      if (!isTerminal && currentStage && targetStage.position <= currentStage.position) {
        return { skipped: 'would_regress' }
      }

      const nowIso = new Date().toISOString()
      const updates: Record<string, any> = { stage_id: targetStage.id, updated_at: nowIso }
      if (targetStage.is_won) {
        updates.deal_status = 'ganho'
        updates.closed_at = nowIso
      } else if (targetStage.is_lost) {
        updates.deal_status = 'perdido'
        updates.closed_at = nowIso
      }

      const { error } = await supabase.from('contatos').update(updates).eq('id', leadId).eq('organization_id', orgId)
      if (error) return { error: error.message }

      await supabase.from('contato_activities').insert({
        contato_id: leadId,
        organization_id: orgId,
        type: 'stage_changed',
        payload: { from: contato.stage_id, to: targetStage.id, auto: true, event: event.name },
        created_by: null,
      })

      return { moved: true, to: targetStage.name }
    })

    return moved
  },
)
