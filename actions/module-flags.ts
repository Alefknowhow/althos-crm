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
import type { ModuleFlags } from '@/lib/module-flags'

export async function setModuleEnabled(niche: NicheKey, moduleKey: ModuleKey, enabled: boolean) {
  if (!(await isSuperAdmin())) return { ok: false as const, error: 'Não autorizado' }

  const admin = createAdminClient()
  const { data, error: readError } = await admin
    .from('system_config')
    .select('value')
    .eq('key', 'disabled_modules')
    .maybeSingle()
  if (readError) return { ok: false as const, error: readError.message }

  const current = (data?.value ?? {}) as ModuleFlags
  const list = new Set(current[niche] ?? [])
  if (enabled) list.delete(moduleKey)
  else list.add(moduleKey)
  const next: ModuleFlags = { ...current, [niche]: Array.from(list) }

  const me = await getUser()
  const { error } = await admin
    .from('system_config')
    .update({ value: next, updated_at: new Date().toISOString(), updated_by: me?.id ?? null })
    .eq('key', 'disabled_modules')
  if (error) return { ok: false as const, error: error.message }

  await admin.from('super_admin_audit_log').insert({
    super_admin_user_id: me?.id,
    action: `module_flag:${niche}:${moduleKey}:${enabled ? 'on' : 'off'}`,
    target_organization_id: null,
  })

  revalidatePath('/super-admin/modulos')
  return { ok: true as const }
}
