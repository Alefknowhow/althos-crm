import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * Single source of truth for the Anthropic API key used by ALL AI features.
 *
 * The platform runs every account's AI calls on ONE centralized token, set via
 * the `ANTHROPIC_API_KEY` environment variable (configured in Vercel). Per-org
 * keys were retired — usage is metered and capped per account through the AI
 * credit system (consume_ai_credits), not by who owns the key.
 *
 * Server-only: never import this from a Client Component.
 */
export function getPlatformAiKey(): string {
  return process.env.ANTHROPIC_API_KEY || ''
}

/** True when the platform token is configured. */
export function hasPlatformAiKey(): boolean {
  return getPlatformAiKey().length > 0
}

/**
 * Single source of truth for the Gemini API key used by Gemini-backed AI
 * features (OCR de documentos, Roteirista, etc.), set via the `GEMINI_API_KEY`
 * environment variable (configured in Vercel) — same centralized-token model
 * as `getPlatformAiKey()` above, just a separate provider/key.
 *
 * Server-only: never import this from a Client Component.
 */
export function getGeminiKey(): string {
  return process.env.GEMINI_API_KEY || ''
}

/** True when the Gemini platform token is configured. */
export function hasGeminiKey(): boolean {
  return getGeminiKey().length > 0
}

/**
 * Single source of truth for a DeepSeek API key, set via `DEEPSEEK_API_KEY`
 * (configured in Vercel) — same centralized-token model as the keys above.
 * DeepSeek exposes an Anthropic-compatible endpoint (`DEEPSEEK_ANTHROPIC_BASE_URL`,
 * default `https://api.deepseek.com/anthropic`), so callers can point the
 * existing `Anthropic` client at it by swapping `apiKey`/`baseURL` — no change
 * to tool_choice/streaming call shapes. See o plano de migração (fases 0-5).
 */
export function getDeepSeekKey(): string {
  return process.env.DEEPSEEK_API_KEY || ''
}

/** True when the DeepSeek platform token is configured. */
export function hasDeepSeekKey(): boolean {
  return getDeepSeekKey().length > 0
}

/** Base URL of DeepSeek's Anthropic-compatible endpoint. */
export function getDeepSeekAnthropicBaseUrl(): string {
  return process.env.DEEPSEEK_ANTHROPIC_BASE_URL || 'https://api.deepseek.com/anthropic'
}

type AnthropicEngineConfig = { apiKey: string; baseURL?: string }

const readAiEngineProvider = cache(async (): Promise<string> => {
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_config')
    .select('value')
    .eq('key', 'ai_engine')
    .maybeSingle()
  return (data?.value as { provider?: string } | null)?.provider || 'anthropic'
})

/**
 * Resolves the `{apiKey, baseURL}` every Anthropic-SDK call site should use,
 * driven by the `ai_engine` row in `system_config` (editable in
 * /super-admin/settings, no redeploy needed). Memoized per request via
 * `cache()`, same pattern as `getDisabledModules` (lib/module-flags.ts).
 *
 * "deepseek" routes through DeepSeek's Anthropic-compatible endpoint, which
 * remaps Claude model ids server-side — callers never need to change the
 * `model:` string they already pass. Falls back to Claude whenever the
 * config is missing/invalid or the DeepSeek key isn't set, so a bad toggle
 * never breaks an AI call.
 */
export async function resolveAnthropicEngine(): Promise<AnthropicEngineConfig> {
  const provider = await readAiEngineProvider()
  if (provider === 'deepseek') {
    if (hasDeepSeekKey()) {
      return { apiKey: getDeepSeekKey(), baseURL: getDeepSeekAnthropicBaseUrl() }
    }
    console.warn('[ai-engine] ai_engine=deepseek mas DEEPSEEK_API_KEY não configurada — usando Claude.')
  }
  return { apiKey: getPlatformAiKey() }
}
