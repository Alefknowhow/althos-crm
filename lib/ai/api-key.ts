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
