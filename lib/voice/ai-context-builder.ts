/**
 * Context Builder — monta o leadProfile enviado ao motor de IA a partir do
 * CRM (contato, tags, origem, custom_fields), reaproveitando o mesmo shape
 * de lib/ai/attendant-engine-core.ts::AttendantInput.leadProfile. Só busca o
 * necessário — nunca despeja o registro inteiro do contato no LLM.
 */
import type { SupabaseClient } from '@supabase/supabase-js'

export async function buildVoiceLeadProfile(supabase: SupabaseClient, orgId: string, contatoId: string) {
  const { data: contato } = await supabase
    .from('contatos')
    .select('name, phone, email, source, tags, custom_fields')
    .eq('id', contatoId)
    .eq('organization_id', orgId)
    .maybeSingle()

  if (!contato) return null

  return {
    name: contato.name,
    phone: contato.phone,
    email: contato.email,
    source: contato.source,
    tags: contato.tags,
    custom_fields: contato.custom_fields,
  }
}
