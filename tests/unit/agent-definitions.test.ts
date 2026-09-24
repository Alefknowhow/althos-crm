import { describe, it, expect } from 'vitest'
import { buildPersonaPromptFromDefinition } from '@/lib/agent-definitions/prompt'
import type { AgentDefinition } from '@/lib/agent-definitions/types'

// lib/agent-definitions/tools.ts (resolveAnthropicTools) não é testado aqui
// de propósito: importa lib/agent/tools/registry.ts, que puxa Server
// Actions ('use server') via lib/supabase/types.ts (React cache()) — fora
// do escopo deste runner (ver vitest.config.ts: "Server actions ... NOT
// covered here").

function baseDefinition(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'def-1',
    organization_id: 'org-1',
    key: 'sdr',
    name: 'Júlia',
    role_label: 'SDR',
    description: null,
    personality: null,
    persona: null,
    tone: 'consultivo',
    language: 'pt-BR',
    objective: null,
    success_criteria: null,
    rules: null,
    additional_instructions: null,
    handoff_conditions: null,
    autonomy_limits: {},
    knowledge: null,
    allowed_tools: [],
    allowed_skills: [],
    model: 'claude-haiku-4-5',
    is_active: true,
    created_by: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildPersonaPromptFromDefinition', () => {
  it('includes name/role and tone/language even with everything else empty', () => {
    const prompt = buildPersonaPromptFromDefinition(baseDefinition())
    expect(prompt).toContain('Você é Júlia, SDR.')
    expect(prompt).toContain('Tom: consultivo. Responda sempre em pt-BR.')
  })

  it('omits sections whose field is empty and includes ones that are set', () => {
    const prompt = buildPersonaPromptFromDefinition(baseDefinition({ objective: 'Qualificar leads', rules: null }))
    expect(prompt).toContain('# Objetivo\nQualificar leads')
    expect(prompt).not.toContain('# Regras')
  })

  it('separates personalidade (behavior) from persona (audience) as distinct sections', () => {
    const prompt = buildPersonaPromptFromDefinition(
      baseDefinition({ personality: 'Direto e objetivo', persona: 'Donos de pequenas empresas' }),
    )
    expect(prompt).toContain('# Personalidade (como você se comporta)\nDireto e objetivo')
    expect(prompt).toContain('# Persona (com quem você fala)\nDonos de pequenas empresas')
  })

  it('tells the model to emit a structured event when handoff conditions are met', () => {
    const prompt = buildPersonaPromptFromDefinition(baseDefinition({ handoff_conditions: 'Cliente pede para falar com humano' }))
    expect(prompt).toContain('Cliente pede para falar com humano')
    expect(prompt).toContain('emit_result')
    expect(prompt).toContain('human_handoff_requested')
  })
})
