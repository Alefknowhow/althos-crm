/**
 * Cliente admin (service role) — este serviço roda fora do Next.js, então
 * não tem acesso a `lib/supabase/server.ts::createAdminClient()`. Mesmo
 * padrão (service role, bypassa RLS deliberadamente): TODA query aqui
 * filtra `organization_id` manualmente, nunca confia em RLS.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

export function getSupabaseAdmin(): SupabaseClient {
  if (client) return client
  const url = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ausentes no serviço realtime.')
  }
  client = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  return client
}

export async function markSessionLive(sessionId: string, organizationId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('sales_coach_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
}

export async function markSessionEnded(
  sessionId: string,
  organizationId: string,
  opts: { status: 'ended' | 'failed'; durationSeconds: number },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('sales_coach_sessions')
    .update({
      status: opts.status,
      ended_at: new Date().toISOString(),
      duration_seconds: opts.durationSeconds,
    })
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
}

export async function insertTranscriptSegment(row: {
  organizationId: string
  sessionId: string
  speaker?: string
  text: string
  isFinal: boolean
  startedAtMs?: number
  endedAtMs?: number
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('call_transcript_segments').insert({
    organization_id: row.organizationId,
    session_id: row.sessionId,
    speaker: row.speaker ?? null,
    text: row.text,
    is_final: row.isFinal,
    started_at_ms: row.startedAtMs ?? null,
    ended_at_ms: row.endedAtMs ?? null,
  })
}
