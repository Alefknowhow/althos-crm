import { describe, it, expect } from 'vitest'
import {
  getPlanLimit,
  planHasFeature,
  minimumPlanFor,
  getCyclePriceCents,
  modelCreditMultiplier,
  getPlanMeta,
  formatPlanPrice,
} from '@/lib/plans/config'

describe('getPlanLimit', () => {
  it('returns the concrete limit for a known plan/key', () => {
    expect(getPlanLimit('free', 'leads')).toBe(100)
    expect(getPlanLimit('starter', 'orgs')).toBe(1)
    expect(getPlanLimit('pro', 'orgs')).toBe(5)
  })

  it('maps -1 (unlimited) to Infinity', () => {
    expect(getPlanLimit('starter', 'leads')).toBe(Infinity)
    expect(getPlanLimit('business', 'orgs')).toBe(Infinity)
  })

  it('falls back to the free plan for unknown/null plans', () => {
    expect(getPlanLimit('nonexistent', 'leads')).toBe(100)
    expect(getPlanLimit(null, 'leads')).toBe(100)
    expect(getPlanLimit(undefined, 'orgs')).toBe(1)
  })
})

describe('planHasFeature', () => {
  it('gates premium features off for free/starter', () => {
    expect(planHasFeature('free', 'ai_insights')).toBe(false)
    expect(planHasFeature('starter', 'ai_insights')).toBe(false)
    expect(planHasFeature('starter', 'export_reports')).toBe(false)
  })

  it('unlocks premium features on pro/business', () => {
    expect(planHasFeature('pro', 'ai_insights')).toBe(true)
    expect(planHasFeature('business', 'export_reports')).toBe(true)
  })

  it('unknown plan is treated as free (most restrictive)', () => {
    expect(planHasFeature('garbage', 'tasks')).toBe(false)
    expect(planHasFeature(null, 'whatsapp')).toBe(false)
  })
})

describe('minimumPlanFor', () => {
  it('finds the cheapest plan that includes a feature', () => {
    expect(minimumPlanFor('tasks')).toBe('starter')
    expect(minimumPlanFor('ai_insights')).toBe('pro')
  })

  it('returns null for a feature no plan offers', () => {
    // white_label was removed from the offering (false in every plan)
    expect(minimumPlanFor('white_label')).toBeNull()
  })
})

describe('getCyclePriceCents', () => {
  it('returns the correct total per billing cycle', () => {
    expect(getCyclePriceCents('pro', 'monthly')).toBe(39700)
    expect(getCyclePriceCents('pro', 'semestral')).toBe(214380)
    expect(getCyclePriceCents('pro', 'annual')).toBe(390648)
  })
})

describe('modelCreditMultiplier', () => {
  it('returns the configured multiplier', () => {
    expect(modelCreditMultiplier('claude-haiku-4-5')).toBe(1)
    expect(modelCreditMultiplier('claude-sonnet-4-6')).toBe(3)
    expect(modelCreditMultiplier('claude-opus-4-7')).toBe(5)
  })

  it('defaults to 1x for unknown/null models', () => {
    expect(modelCreditMultiplier('mystery-model')).toBe(1)
    expect(modelCreditMultiplier(null)).toBe(1)
    expect(modelCreditMultiplier(undefined)).toBe(1)
  })
})

describe('getPlanMeta', () => {
  it('resolves metadata and defaults to free', () => {
    expect(getPlanMeta('starter').aiCreditsMonthly).toBe(300)
    expect(getPlanMeta('garbage').id).toBe('free')
  })
})

describe('formatPlanPrice', () => {
  it('formats cents as a BRL string', () => {
    const s = formatPlanPrice(13700)
    expect(s).toContain('R$')
    expect(s).toContain('137')
    expect(s).toContain('00')
  })
})
