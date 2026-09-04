/**
 * Shared types/helpers for integration health probes.
 * Split out of lib/health/checks.ts.
 */

export type IntegrationName = 'whatsapp' | 'email' | 'inngest' | 'supabase'

export type HealthStatus = 'healthy' | 'warning' | 'error' | 'disconnected'

/** One sub-check inside an integration (e.g. "token válido", "webhook ativo"). */
export interface HealthDetailCheck {
  label: string
  ok: boolean | null // null = não verificável / não aplicável
  message?: string
}

export interface HealthResult {
  integration: IntegrationName
  status: HealthStatus
  /** Short headline shown on the card, e.g. "Conectado" / "Token expirado". */
  summary: string
  details: HealthDetailCheck[]
  /** Optional extra context (last error, response codes) for the timeline. */
  meta?: Record<string, unknown>
  checkedAt: string
}

const PROBE_TIMEOUT_MS = 8_000

/** Build an AbortSignal that trips after the probe timeout (fetch-safe). */
export function probeSignal(): AbortSignal {
  // AbortSignal.timeout is available on the Node 18+ / Edge runtimes Vercel uses.
  return AbortSignal.timeout(PROBE_TIMEOUT_MS)
}

export function nowISO() {
  return new Date().toISOString()
}

/** Worst-status reducer: error > warning > disconnected > healthy. */
export function rollup(checks: HealthDetailCheck[]): HealthStatus {
  if (checks.some(c => c.ok === false)) return 'error'
  if (checks.some(c => c.ok === null)) return 'warning'
  return 'healthy'
}
