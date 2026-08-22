'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'
import { revalidatePath } from 'next/cache'

/**
 * Configuração de lembrete de renovação (Vertical Seguros, Fase 4) — ver
 * supabase/migrations/0188_insurance_renewal_settings.sql. Lê/grava
 * org_settings.insurance_renewal_reminder_days, consumido pelo cron
 * lib/inngest/insurance-crons.ts.
 */

const DaysSchema = z.array(z.number().int().min(1).max(365)).min(1).max(10)

async function requireAccess(orgSlug: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const check = await checkMemberPermission(org.id, user.id, 'seguros')
  if (!check.allowed) throw new Error(check.reason || 'Sem permissão')
  return { org, user }
}

export async function getInsuranceRenewalSettings(orgSlug: string): Promise<number[]> {
  const { org } = await requireAccess(orgSlug)
  const supabase = createClient()
  const { data } = await supabase
    .from('org_settings')
    .select('insurance_renewal_reminder_days')
    .eq('org_id', org.id)
    .maybeSingle()
  return data?.insurance_renewal_reminder_days || [60, 30, 15]
}

export async function saveInsuranceRenewalSettings(orgSlug: string, days: unknown) {
  const { org } = await requireAccess(orgSlug)
  const parsed = DaysSchema.safeParse(days)
  if (!parsed.success) return { ok: false as const, error: 'Dados inválidos: ' + parsed.error.issues[0]?.message }

  const supabase = createClient()
  const sorted = Array.from(new Set(parsed.data)).sort((a, b) => b - a)
  const { error } = await supabase
    .from('org_settings')
    .update({ insurance_renewal_reminder_days: sorted })
    .eq('org_id', org.id)
  if (error) return { ok: false as const, error: error.message }

  revalidatePath(`/app/${orgSlug}/apolices`)
  return { ok: true as const }
}
