import { describe, it, expect } from 'vitest'
import { canonicalNicheText, verticalFromCapabilityKey } from '@/lib/capabilities/vertical-access.server'
import { nicheKeyFor, type NicheKey } from '@/lib/niche'
import type { CapabilityKey } from '@/lib/capabilities/types'

const ALL_VERTICALS: NicheKey[] = ['viagens', 'clinicas', 'imoveis', 'seguros', 'trafego', 'advocacia']

describe('canonicalNicheText', () => {
  it('round-trips through nicheKeyFor for every NicheKey — guards against drift in lib/niche.ts substring matchers', () => {
    for (const vertical of ALL_VERTICALS) {
      const text = canonicalNicheText(vertical)
      expect(nicheKeyFor(text), `canonicalNicheText('${vertical}') = '${text}' should resolve back to '${vertical}'`).toBe(vertical)
    }
  })
})

describe('verticalFromCapabilityKey', () => {
  it('maps travel capabilities (umbrella and children) to viagens', () => {
    expect(verticalFromCapabilityKey('vertical.travel')).toBe('viagens')
    expect(verticalFromCapabilityKey('vertical.travel.cotacoes')).toBe('viagens')
    expect(verticalFromCapabilityKey('vertical.travel.reservas')).toBe('viagens')
  })

  it('maps clinic capabilities (umbrella and children) to clinicas', () => {
    expect(verticalFromCapabilityKey('vertical.clinic')).toBe('clinicas')
    expect(verticalFromCapabilityKey('vertical.clinic.prontuario')).toBe('clinicas')
  })

  it('maps single-module verticals directly', () => {
    expect(verticalFromCapabilityKey('vertical.real_estate')).toBe('imoveis')
    expect(verticalFromCapabilityKey('vertical.insurance')).toBe('seguros')
    expect(verticalFromCapabilityKey('vertical.traffic')).toBe('trafego')
  })

  it('returns null for Core capabilities — they never go through the vertical bypass', () => {
    const coreKeys: CapabilityKey[] = ['core.contacts', 'core.pipeline', 'core.dashboards', 'core.conversations']
    for (const key of coreKeys) {
      expect(verticalFromCapabilityKey(key)).toBeNull()
    }
  })
})
