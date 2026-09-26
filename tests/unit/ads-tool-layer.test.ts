import { describe, it, expect, vi } from 'vitest'
import { getAdsAdapter, AdsCapabilityError } from '@/lib/ads'

describe('Ads Tool Layer — capability gating', () => {
  it('Meta adapter reports read capabilities true, write false by default', () => {
    const adapter = getAdsAdapter('meta')
    expect(adapter.capabilities.readCampaigns).toBe(true)
    expect(adapter.capabilities.readInsights).toBe(true)
    expect(adapter.capabilities.pauseCampaign).toBe(false)
    expect(adapter.capabilities.updateBudget).toBe(false)
  })

  it('Google adapter reports every capability false and throws AdsCapabilityError on any call', async () => {
    const adapter = getAdsAdapter('google')
    expect(Object.values(adapter.capabilities).every(v => v === false)).toBe(true)
    await expect(adapter.fetchCampaigns!('123', 'token')).rejects.toBeInstanceOf(AdsCapabilityError)
  })
})

describe('Ads Tool Layer — Meta adapter normalization', () => {
  it('normalizes fetchCampaigns from lib/meta/ads fixture (no network)', async () => {
    vi.doMock('@/lib/meta/ads', () => ({
      fetchMetaCampaigns: vi.fn().mockResolvedValue([
        { id: '123', name: 'Campanha Teste', objective: 'LEAD_GENERATION', status: 'ACTIVE', start_time: null, stop_time: null },
      ]),
    }))
    const { metaAdsAdapter } = await import('@/lib/ads/providers/meta')
    const rows = await metaAdsAdapter.fetchCampaigns!('act_1', 'fake-token')
    expect(rows).toEqual([
      { id: '123', name: 'Campanha Teste', status: 'active', objective: 'LEAD_GENERATION', raw: expect.any(Object) },
    ])
    vi.doUnmock('@/lib/meta/ads')
  })

  it('normalizes fetchInsights spend/leads/purchases fields', async () => {
    vi.doMock('@/lib/meta/ads', () => ({
      fetchMetaInsights: vi.fn().mockResolvedValue([
        { entity_id: '123', date: '2026-09-01', impressions: 1000, clicks: 20, spend_cents: 5000, meta_leads: 3, meta_messaging_started: 0, meta_link_clicks: 15, meta_landing_page_views: 10, meta_purchases: 1, meta_purchase_value_cents: 20000 },
      ]),
    }))
    const { metaAdsAdapter } = await import('@/lib/ads/providers/meta')
    const rows = await metaAdsAdapter.fetchInsights!('123', 'fake-token', '2026-09-01', '2026-09-01')
    expect(rows[0]).toMatchObject({ entityId: '123', date: '2026-09-01', spendCents: 5000, leads: 3, purchases: 1, purchaseValueCents: 20000 })
    vi.doUnmock('@/lib/meta/ads')
  })
})
