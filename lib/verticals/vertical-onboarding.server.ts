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

  // completed_at só entra no payload quando `completed` é passado
  // explicitamente. Antes, qualquer chamada sem opts.completed (o formato
  // padrão de salvar um passo intermediário) escrevia completed_at: null
  // incondicionalmente — reabrindo silenciosamente um onboarding já
  // concluído a cada save de passo seguinte (achado da revisão automática
  // da PR #37). onConflict faz UPDATE só das colunas presentes no objeto,
  // então omitir a chave preserva o valor já gravado.
  const payload: { organization_id: string; vertical: NicheKey; step: number; completed_at?: string } = {
    organization_id: orgId,
    vertical,
    step,
  }
  if (opts?.completed) payload.completed_at = new Date().toISOString()

  const { error } = await supabase
    .from('vertical_onboarding_progress')
    .upsert(payload, { onConflict: 'organization_id,vertical' })
  if (error) throw new Error(error.message)
}
