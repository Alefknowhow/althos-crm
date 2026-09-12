/**
 * Kill-switch global de módulos por nicho — generaliza o antigo
 * `PRONTUARIO_ENABLED` hardcoded (lib/niche-modules.ts) pra qualquer
 * módulo, configurável via /super-admin/modulos, sem precisar de deploy.
 *
 * Lido por QUALQUER usuário navegando o CRM (não só super-admin) — decide
 * o que ele vê no menu e se a rota do módulo responde ou dá 404. Por isso
 * `getDisabledModules` usa `createAdminClient()` (bypassa a RLS de
 * `system_config`, que só permite leitura a super-admin) — o retorno é só
 * um mapa de chaves módulo/nicho, sem dado sensível de nenhuma org.
 */

import { cache } from 'react'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { nicheKeyFor, type NicheKey } from '@/lib/niche'
import { isModuleEnabled, type ModuleKey } from '@/lib/niche-modules'

export type ModuleFlags = Partial<Record<NicheKey, ModuleKey[]>>

/** Memoizado só dentro do request/render atual (React Server Components)
 *  — sem TTL cross-request pra gerenciar, cada request novo já lê o valor
 *  atual do banco. */
export const getDisabledModules = cache(async (): Promise<ModuleFlags> => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_config')
    .select('value')
    .eq('key', 'disabled_modules')
    .maybeSingle()
  return (data?.value ?? {}) as ModuleFlags
})

export async function getDisabledModulesForNiche(niche: string | null | undefined): Promise<ModuleKey[]> {
  const key = nicheKeyFor(niche)
  if (!key) return []
  const all = await getDisabledModules()
  return all[key] ?? []
}

/** Substitui os checks manuais de nicho (`if (!isXNiche(org.niche))
 *  notFound()`) espalhados pelas páginas de cada módulo — mesmo
 *  resultado pra quem já tinha acesso, mais o kill-switch global. */
export async function requireModuleEnabled(niche: string | null | undefined, key: ModuleKey): Promise<void> {
  const disabled = await getDisabledModulesForNiche(niche)
  if (!isModuleEnabled(niche, key, disabled)) notFound()
}
