import { createAdminClient } from '@/lib/supabase/server'
import { TwilioVoiceProvider } from './providers/twilio'
import type { VoiceProvider } from './provider'

/**
 * Resolve o VoiceProvider configurado para uma organização. Único ponto do
 * módulo que lê voice_provider_credentials (tabela sem RLS policy de SELECT
 * pro client — só o service role, via createAdminClient(), consegue ler).
 */
export async function getVoiceProvider(organizationId: string): Promise<VoiceProvider> {
  const admin = createAdminClient()
  const { data: account, error } = await admin
    .from('voice_accounts')
    .select('id, provider, provider_subaccount_sid, status')
    .eq('organization_id', organizationId)
    .single()

  if (error || !account) throw new Error('Althos Voice ainda não foi configurado para esta organização.')
  if (account.status !== 'active') throw new Error('Althos Voice está pendente de configuração para esta organização.')

  const { data: creds, error: credsError } = await admin
    .from('voice_provider_credentials')
    .select('auth_token')
    .eq('voice_account_id', account.id)
    .single()

  if (credsError || !creds) throw new Error('Credenciais do Althos Voice não encontradas.')

  if (account.provider === 'twilio') {
    return new TwilioVoiceProvider(account.provider_subaccount_sid!, creds.auth_token)
  }
  throw new Error(`Provider de voz não suportado: ${account.provider}`)
}
