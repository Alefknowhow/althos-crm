'use server'

/**
 * Global quick search — backs the Cmd+K palette.
 *
 * Returns the top few hits across leads + customers, scoped to the active
 * org's RLS context. Kept deliberately small (LIMIT 6 per kind) so the
 * palette stays snappy and the network payload tiny.
 */

import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'

export type SearchHit = {
  kind: 'lead' | 'customer'
  id: string
  title: string
  subtitle: string | null
  href: string
}

export async function searchEverything(
  orgSlug: string,
  rawQuery: string,
): Promise<SearchHit[]> {
  const q = (rawQuery || '').trim()
  if (q.length < 2) return []

  const org = await getCurrentOrganization(orgSlug)
  const supabase = createClient()

  // Escape ilike wildcards so a user typing "%" doesn't match everything.
  const safe = q.replace(/[%_]/g, '\\$&')
  const like = `%${safe}%`

  // Leads search across name/email/phone. RLS gates by org_id but we add
  // explicit .eq for query-plan clarity.
  const leadsP = supabase
    .from('contatos')
    .select('id, name, email, phone, status')
    .eq('organization_id', org.id)
    .or(`name.ilike.${like},email.ilike.${like},phone.ilike.${like}`)
    .limit(8)

  const [{ data: leads }] = await Promise.all([leadsP])

  const hits: SearchHit[] = []

  // Contatos com status 'cliente' ganham um bucket próprio; os demais
  // entram como 'lead'. Ambos linkam para a página unificada /contatos/{id}.
  for (const l of leads || []) {
    if ((l as any).status === 'cliente') {
      hits.push({
        kind: 'customer',
        id: l.id,
        title: l.name,
        subtitle: l.email || l.phone || null,
        href: `/app/${orgSlug}/contatos/${l.id}`,
      })
    } else {
      hits.push({
        kind: 'lead',
        id: l.id,
        title: l.name,
        subtitle: l.email || l.phone || null,
        href: `/app/${orgSlug}/contatos/${l.id}`,
      })
    }
  }

  // Stable ordering: customers first (intent: existing relationship),
  // then leads. Both already sorted by Postgres default; just split.
  hits.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'customer' ? -1 : 1))

  return hits.slice(0, 12)
}
