'use server'

/**
 * Kill-switch global de módulos por nicho (/super-admin/modulos) — mesmo
 * padrão de `updateSystemConfig` (actions/super-admin-referrals.ts),
 * escrevendo na mesma linha `disabled_modules` de `system_config` que
 * `lib/module-flags.ts` lê pra gatear menu/rota de cada módulo.
 */

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/server'
import { isSuperAdmin, getUser } from '@/lib/supabase/types'
import type { NicheKey } from '@/lib/niche'
import type { ModuleKey } from '@/lib/niche-modules'

export async function setModuleEnabled(niche: NicheKey, moduleKey: ModuleKey, enabled: boolean) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const me = await getUser()
  if (!me) return { ok: false as const, error: 'Não autenticado' }

  const admin = createAdminClient()

  // RPC transacional (0266): lê o estado atual, calcula o valor anterior
  // de verdade (não o inverso lógico do pedido), grava e audita numa
  // transação só — achados #1 e #8 da revisão automática da PR #38.
  const { error } = await admin.rpc('admin_set_module_flag', {
    p_niche: niche,
    p_module_key: moduleKey,
    p_enabled: enabled,
    p_actor_id: me.id,
    p_reason: 'Kill-switch de módulo via /super-admin/modulos',
  })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath('/super-admin/modulos')
  return { ok: true as const }
}
