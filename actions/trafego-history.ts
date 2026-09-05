'use server'

import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

export type TrafficActivity = { id: string; type: string; payload: any; created_at: string }

/**
 * Timeline operacional do cliente de tráfego — reusa contato_activities
 * (Core, mesma tabela de Contatos/Pipeline) em vez de criar uma tabela de
 * auditoria própria da vertical. Os tipos `traffic_*` são gravados em
 * actions/traffic-client-profile.ts e actions/campaign-creatives.ts.
 *
 * Filtrado a um allow-list de tipos relacionados a campanha/alteração de
 * cadastro — um cliente de tráfego também é um `contato` normal, então sem
 * esse filtro a mesma tabela traria stage_changed, whatsapp_received, nps_*
 * etc. (atividade de outros módulos que nada tem a ver com a operação de
 * tráfego), poluindo o Histórico.
 */
const RELEVANT_TYPES = ['traffic_profile_updated', 'traffic_creative_status_changed', 'manual_created'] as const

export async function listClientActivity(orgSlug: string, contatoId: string, limit = 50): Promise<TrafficActivity[]> {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'trafego')
  if (!perm.allowed) return []
  const supabase = createClient()
  const { data } = await supabase
    .from('contato_activities')
    .select('id, type, payload, created_at')
    .eq('contato_id', contatoId)
    .eq('organization_id', org.id)
    .in('type', RELEVANT_TYPES)
    .order('created_at', { ascending: false })
    .limit(limit)
  return (data as TrafficActivity[]) || []
}
