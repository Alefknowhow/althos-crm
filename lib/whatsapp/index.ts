import { createAdminClient } from '@/lib/supabase/server'
import { MetaCloudProvider } from './providers/meta-cloud'
import { QrProvider } from './providers/qr'
import type { WhatsAppConnection, WhatsAppProvider } from './types'

export * from './types'

/** Build the right provider implementation for a connection row. */
export function getProvider(conn: WhatsAppConnection): WhatsAppProvider {
  return conn.provider === 'qr'
    ? new QrProvider(conn)
    : new MetaCloudProvider(conn)
}

const CONN_FIELDS =
  'id, organization_id, provider, status, is_enabled, display_name, phone_number, ' +
  'phone_number_id, access_token, gateway_instance, qr_code, last_connected_at, last_error'

/**
 * The single ENABLED connection for an org (one-per-org model).
 * Uses the admin client so it works from webhooks / Inngest as well as
 * server actions; callers are responsible for the org-scoping.
 */
export async function getActiveConnection(orgId: string): Promise<WhatsAppConnection | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_connections')
    .select(CONN_FIELDS)
    .eq('organization_id', orgId)
    .eq('is_enabled', true)
    .maybeSingle()
  return (data as WhatsAppConnection | null) ?? null
}

/** Look up a connection bound to a gateway instance (for QR webhooks). */
export async function getConnectionByGatewayInstance(instance: string): Promise<WhatsAppConnection | null> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_connections')
    .select(CONN_FIELDS)
    .eq('gateway_instance', instance)
    .maybeSingle()
  return (data as WhatsAppConnection | null) ?? null
}

/**
 * Resolve an outbound provider for an org, preferring the new connections
 * table and falling back to the legacy organizations.whatsapp_* columns so
 * nothing breaks during the migration period.
 *
 * `org` is the organizations row (already loaded by the caller).
 */
export async function resolveOutboundProvider(org: {
  id: string
  whatsapp_phone_number_id?: string | null
  whatsapp_access_token?: string | null
}): Promise<WhatsAppProvider | null> {
  const conn = await getActiveConnection(org.id)
  if (conn) return getProvider(conn)

  // Legacy fallback: synthesize a cloud_api connection from org columns.
  if (org.whatsapp_phone_number_id && org.whatsapp_access_token) {
    return new MetaCloudProvider({
      id: 'legacy',
      organization_id: org.id,
      provider: 'cloud_api',
      status: 'connected',
      is_enabled: true,
      display_name: 'WhatsApp Oficial',
      phone_number: null,
      phone_number_id: org.whatsapp_phone_number_id,
      access_token: org.whatsapp_access_token,
      gateway_instance: null,
      qr_code: null,
      last_connected_at: null,
      last_error: null,
    })
  }
  return null
}
