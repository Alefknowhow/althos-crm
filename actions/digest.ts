'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'
import { buildDigestData, buildDigestHtml } from '@/lib/digest/daily-digest'

export async function getDigestSettings(orgSlug: string): Promise<{ enabled: boolean }> {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('org_settings')
    .select('digest_enabled')
    .eq('org_id', org.id)
    .maybeSingle()
  return { enabled: !!data?.digest_enabled }
}

export async function updateDigestSettings(orgSlug: string, enabled: boolean) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const { error } = await supabase
    .from('org_settings')
    .upsert({ org_id: org.id, digest_enabled: enabled }, { onConflict: 'org_id' })
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/configuracoes/notificacoes`)
  return { ok: true as const }
}

/** Monta o HTML do resumo diário com os dados reais da org, sem enviar
 *  nenhum e-mail — usado pelo botão "Pré-visualizar" nas configurações. */
export async function previewDailyDigest(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'settings')
  if (!perm.allowed) return { ok: false as const, error: perm.reason }

  const supabase = createClient()
  const data = await buildDigestData(supabase, org.id, (org as any).niche)
  const html = buildDigestHtml(org.name, orgSlug, data)
  return { ok: true as const, html }
}
