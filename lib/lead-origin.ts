import { contatoSourceLabel } from '@/lib/contatos'

export type LeadOrigin = {
  source?: string | null
  meta_ad_id?: string | null
  meta_ctwa_clid?: string | null
  meta_resolved_campaign_id?: string | null
  origin_campaign?: { name?: string | null } | null
  origin_tracking?: { label?: string | null; campaign?: { name?: string | null } | null } | null
}

export function leadOriginLabel(lead: LeadOrigin): string {
  const source = contatoSourceLabel(lead.source)
  const campaign = lead.origin_campaign?.name || lead.origin_tracking?.campaign?.name
  if (campaign) return `${source} · Campanha: ${campaign}`
  if (lead.meta_ad_id || lead.meta_ctwa_clid || lead.meta_resolved_campaign_id) {
    return `${source} · Anúncio (campanha não identificada)`
  }
  if (lead.origin_tracking?.label) return `${source} · ${lead.origin_tracking.label}`
  // A ausência de atribuição não prova que a aquisição foi orgânica.
  if (lead.source === 'whatsapp') return 'WhatsApp · Sem campanha identificada'
  return source
}
