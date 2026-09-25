/**
 * Agrupa `contatos.source` (texto livre gravado pelos vários fluxos de
 * entrada) num conjunto pequeno de rótulos legíveis para os gráficos de
 * origem do Dashboard. Mesma ideia de `classifyLeadSource` em
 * actions/dashboard-tabs-products.ts, com alguns rótulos a mais (Indicação,
 * Orgânico, Campanha). Origens desconhecidas aparecem com o próprio texto
 * capitalizado — nada cai genericamente em "Outro".
 */
export function classifySourceLabel(raw: string | null | undefined, referred = false): string {
  if (referred) return 'Indicação'
  const s = (raw || '').trim().toLowerCase()
  if (!s) return 'Manual'
  if (s.includes('indica') || s.includes('referral')) return 'Indicação'
  if (s.includes('meta') || s.includes('facebook') || s.includes('fb_ad') || s.includes('instagram_ad') || s.includes('ctwa')) return 'Meta Ads'
  if (s.includes('google')) return 'Google'
  if (s.startsWith('instagram')) return 'Instagram'
  if (s.startsWith('whatsapp')) return 'WhatsApp'
  if (s.startsWith('campaign:')) return 'Campanha'
  if (s.startsWith('form')) return 'Formulário'
  if (s.startsWith('agendamento')) return 'Agendamento'
  if (s.includes('organic') || s.includes('orgânico') || s.includes('organico') || s === 'site') return 'Orgânico'
  if (s.startsWith('manual')) return 'Manual'
  if (s.startsWith('api') || s.startsWith('csv') || s.startsWith('import')) return 'Importação'
  const t = (raw || '').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}
