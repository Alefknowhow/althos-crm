'use server'

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import { revalidatePath } from 'next/cache'

export async function updateOnboardingStep(orgSlug: string, step: number, data?: any) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  const updates: any = { onboarding_step: step }
  
  if (data?.sector) updates.sector = data.sector
  if (data?.team_size) updates.team_size = data.team_size
  
  if (step === 4) {
    updates.onboarding_completed_at = new Date().toISOString()
  }

  const { error } = await supabase
    .from('organizations')
    .update(updates)
    .eq('id', org.id)

  if (error) return { ok: false, error: error.message }

  revalidatePath(`/app/${orgSlug}`)
  return { ok: true }
}

export async function createInitialFunnel(orgSlug: string, name: string, stages: string[]) {
  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // 1. Create pipeline
  const { data: pipeline, error: pipeError } = await supabase
    .from('pipelines')
    .insert({
      organization_id: org.id,
      name,
      is_default: false // The system already has a default "Vendas" from creation
    })
    .select()
    .single()

  if (pipeError) return { ok: false, error: pipeError.message }

  // 2. Create stages
  const stageInserts = stages.map((s, i) => ({
    pipeline_id: pipeline.id,
    name: s,
    position: i + 1,
    color: '#3b82f6'
  }))

  const { error: stageError } = await supabase
    .from('pipeline_stages')
    .insert(stageInserts)

  if (stageError) return { ok: false, error: stageError.message }

  return { ok: true }
}
