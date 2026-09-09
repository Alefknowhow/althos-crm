import { describe, expect, it } from 'vitest'
import { leadOriginLabel } from '@/lib/lead-origin'

describe('origem do lead', () => {
  it('identifica a campanha de aquisição sem perder o canal', () => {
    expect(leadOriginLabel({ source: 'whatsapp', origin_campaign: { name: 'Implantes setembro' } })).toBe('WhatsApp · Campanha: Implantes setembro')
  })
  it('reutiliza a campanha de links rastreados', () => {
    expect(leadOriginLabel({ source: 'instagram', origin_tracking: { campaign: { name: 'HOF' } } })).toBe('Instagram · Campanha: HOF')
  })
  it('não confunde anúncio sem campanha resolvida com entrada direta', () => {
    expect(leadOriginLabel({ source: 'whatsapp', meta_ad_id: '123' })).toContain('Anúncio (campanha não identificada)')
    expect(leadOriginLabel({ source: 'whatsapp' })).toBe('WhatsApp · Sem campanha identificada')
  })
  it('preserva fontes livres e não inventa origem ausente', () => {
    expect(leadOriginLabel({ source: 'Indicação da Ana' })).toBe('Indicação da Ana')
    expect(leadOriginLabel({})).toBe('Sem origem')
  })
})
