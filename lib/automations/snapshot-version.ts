import type { createAdminClient } from '@/lib/supabase/server'

/**
 * Cria um snapshot imutável (`automation_versions`) da definição atual da
 * automação e aponta `automations.current_version_id` pra ele — issue #18
 * §18. Chamado sempre que trigger/steps/flow mudam (create/update/duplicate
 * em actions/automations.ts), nunca em runtime de execução.
 *
 * Best-effort: se o snapshot falhar, a automação continua funcionando no
 * modelo antigo (motor cai pro fallback de ler `automations.steps/flow` ao
 * vivo quando o run não tem `automation_version_id`) — nunca bloqueia a
 * escrita principal por causa do histórico de versão.
 */
export async function snapshotAutomationVersion(
  admin: ReturnType<typeof createAdminClient>,
  automation: {
    id: string
    organization_id: string
    trigger_type: string
    trigger_config: Record<string, any>
    steps: any[]
    flow?: Record<string, any> | null
  },
): Promise<string | null> {
  try {
    const { count } = await admin
      .from('automation_versions')
      .select('id', { count: 'exact', head: true })
      .eq('automation_id', automation.id)

    const { data: version, error } = await admin
      .from('automation_versions')
      .insert({
        automation_id: automation.id,
        organization_id: automation.organization_id,
        version_number: (count ?? 0) + 1,
        trigger_type: automation.trigger_type,
        trigger_config: automation.trigger_config ?? {},
        steps: automation.steps ?? [],
        flow: automation.flow ?? null,
      })
      .select('id')
      .single()

    if (error || !version) return null

    await admin.from('automations').update({ current_version_id: version.id }).eq('id', automation.id)
    return version.id
  } catch {
    return null
  }
}
