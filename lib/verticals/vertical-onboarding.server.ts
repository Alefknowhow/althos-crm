// Server-only. Onboarding POR VERTICAL (migration 0263), independente do
// onboarding Core existente (organizations.onboarding_step/
// onboarding_completed_at — actions/onboarding.ts, inalterado). Issue #32:
// "Separar: Core Onboarding; Vertical Onboarding. Onboardings independentes
// e retomáveis."

import { createClient } from '@/lib/supabase/server'
import type { NicheKey } from '@/lib/niche'

export interface VerticalOnboardingProgress {
  vertical: NicheKey
  step: number
  completedAt: string | null
}

/** Usa o client normal (RLS) — onboarding de vertical é dado da própria org, sem precisar de admin client. */
export async function getVerticalOnboardingProgress(orgId: string, vertical: NicheKey): Promise<VerticalOnboardingProgress | null> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('vertical_onboarding_progress')
    .select('vertical, step, completed_at')
    .eq('organization_id', orgId)
    .eq('vertical', vertical)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return { vertical: data.vertical, step: data.step, completedAt: data.completed_at }
}

export async function updateVerticalOnboardingStep(
  orgId: string,
  vertical: NicheKey,
  step: number,
  opts?: { completed?: boolean },
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('vertical_onboarding_progress')
    .upsert(
      {
        organization_id: orgId,
        vertical,
        step,
        completed_at: opts?.completed ? new Date().toISOString() : null,
      },
      { onConflict: 'organization_id,vertical' },
    )
  if (error) throw new Error(error.message)
}
