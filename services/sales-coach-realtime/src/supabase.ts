/**
 * Cliente admin (service role) — este serviço roda fora do Next.js, então
 * não tem acesso a `lib/supabase/server.ts::createAdminClient()`. Mesmo
 * padrão (service role, bypassa RLS deliberadamente): TODA query aqui
 * filtra `organization_id` manualmente, nunca confia em RLS.
 *
 * `createClient()` do @supabase/supabase-js sempre instancia um
 * RealtimeClient internamente, mesmo quando não usamos `.channel()` —
 * e esse RealtimeClient exige `WebSocket` global nativo (só existe a
 * partir do Node 22). No Node 20 (imagem do Dockerfile) isso lança uma
 * exceção não capturada e DERRUBA O PROCESSO INTEIRO na primeira chamada
 * ao Supabase (achado real em produção — Railway, 2026-09-17, via
 * `/debug-env` + logs: WS fechava com código 1006 sem nenhuma mensagem de
 * erro no cliente, só nos logs do servidor). Polyfill com `ws` (já é
 * dependência deste serviço) resolve sem precisar trocar a imagem base.
 */
import WebSocket from 'ws'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

if (!('WebSocket' in globalThis)) {
  ;(globalThis as unknown as { WebSocket: typeof WebSocket }).WebSocket = WebSocket
}

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

export async function markAssistedSessionLive(sessionId: string, organizationId: string): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('voice_assisted_sessions')
    .update({ status: 'live', started_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
}

export async function markAssistedSessionEnded(
  sessionId: string,
  organizationId: string,
  opts: { status: 'ended' | 'failed'; durationSeconds: number },
): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase
    .from('voice_assisted_sessions')
    .update({
      status: opts.status,
      ended_at: new Date().toISOString(),
      duration_seconds: opts.durationSeconds,
    })
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
}

export async function getAssistedSession(sessionId: string, organizationId: string) {
  const supabase = getSupabaseAdmin()
  const { data } = await supabase
    .from('voice_assisted_sessions')
    .select('id, status, target_language')
    .eq('id', sessionId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  return data
}

export async function insertAssistedTranscriptSegment(row: {
  organizationId: string
  sessionId: string
  speaker: 'supplier' | 'agent'
  originalText: string
  originalLanguage?: string
  translatedText?: string
  startedAtMs?: number
  endedAtMs?: number
}): Promise<void> {
  const supabase = getSupabaseAdmin()
  await supabase.from('voice_assisted_transcript_segments').insert({
    organization_id: row.organizationId,
    session_id: row.sessionId,
    speaker: row.speaker,
    original_text: row.originalText,
    original_language: row.originalLanguage ?? null,
    translated_text: row.translatedText ?? null,
    started_at_ms: row.startedAtMs ?? null,
    ended_at_ms: row.endedAtMs ?? null,
  })
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
