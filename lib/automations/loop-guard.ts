import type { createAdminClient } from '../supabase/server'

/**
 * Prevenção de loop (issue #18 §27) — genérico, vale pra qualquer trigger:
 * se a MESMA automação disparou pro MESMO contato mais que
 * `LOOP_GUARD_MAX_RUNS` vezes numa janela curta, é quase certo um ciclo
 * (ex.: step "add_tag" cuja tag disparada é a mesma configurada no trigger
 * "lead.tag_added", refirando a si mesma) — não algo que um uso real geraria
 * em poucos minutos. Extraído de lib/inngest/automation.ts só por tamanho de
 * arquivo (limite de 350 linhas do projeto).
 */
const LOOP_GUARD_WINDOW_MS = 10 * 60 * 1000
const LOOP_GUARD_MAX_RUNS = 5

/**
 * Se o disparo estiver dentro do limite, grava o `automation_runs` como
 * 'running' e retorna `{ blocked: false, run }`. Se exceder, grava como
 * 'failed' com o motivo (aparece no histórico/logs em vez de sumir em
 * silêncio) e retorna `{ blocked: true, run: null }` — o caller não deve
 * disparar `automation.run.execute` nesse caso.
 */
export async function createAutomationRunWithLoopGuard(
  supabase: ReturnType<typeof createAdminClient>,
  args: {
    organizationId: string
    automationId: string
    automationVersionId: string | null
    contatoId: string
    triggerPayload: Record<string, any>
  },
): Promise<{ blocked: boolean; run: { id: string } | null }> {
  const windowStart = new Date(Date.now() - LOOP_GUARD_WINDOW_MS).toISOString()
  const { count: recentRuns } = await supabase
    .from('automation_runs')
    .select('id', { count: 'exact', head: true })
    .eq('automation_id', args.automationId)
    .eq('contato_id', args.contatoId)
    .gte('created_at', windowStart)

  const basePayload = {
    organization_id: args.organizationId,
    automation_id: args.automationId,
    automation_version_id: args.automationVersionId,
    contato_id: args.contatoId,
    current_step: 0,
    started_at: new Date().toISOString(),
    trigger_payload: args.triggerPayload ?? {},
  }

  if ((recentRuns ?? 0) >= LOOP_GUARD_MAX_RUNS) {
    await supabase.from('automation_runs').insert({
      ...basePayload,
      status: 'failed',
      completed_at: new Date().toISOString(),
      error: `Disparo bloqueado: automação executou ${recentRuns}+ vezes para este contato nos últimos 10 minutos (prevenção de loop).`,
    })
    return { blocked: true, run: null }
  }

  const { data: run, error } = await supabase.from('automation_runs').insert({
    ...basePayload,
    status: 'running',
  }).select('id').single()

  if (error || !run) {
    throw new Error(`Falha ao criar automation_run: ${error?.message}`)
  }

  return { blocked: false, run }
}
