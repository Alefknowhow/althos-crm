/**
 * Integration health probes -- barrel.
 *
 * Each probe is a pure-ish async function that performs a small, bounded
 * network/DB check and returns a typed {@link HealthResult}. They never throw:
 * any failure is captured and reported as a 'warning' or 'error' status with a
 * human-readable message, so the cron writer and the on-demand action can
 * always persist a row.
 *
 * Probes are intentionally cheap (single request, 8s timeout) because they run
 * for every org every 15 minutes.
 *
 * Split across:
 *   - checks-shared.ts: shared types (IntegrationName, HealthStatus,
 *     HealthResult) and helpers (probeSignal, nowISO, rollup)
 *   - checks-whatsapp.ts: checkWhatsapp
 *   - checks-email.ts: checkEmail
 * This file keeps checkInngest/checkSupabase (cheap, no network fan-out).
 */

export * from './checks-shared'
export { checkWhatsapp, type WhatsappConfig } from './checks-whatsapp'
export { checkEmail, type EmailConfig } from './checks-email'

import { nowISO, type HealthResult, type HealthDetailCheck, type HealthStatus } from './checks-shared'

// ---------------------------------------------------------------------------
// Inngest — configuração + falhas recentes de automação como proxy de saúde
// ---------------------------------------------------------------------------

export interface InngestSignals {
  /** Quantidade de automation_runs com status 'failed' nas últimas 24h. */
  recentFailures: number
  /** Total de runs nas últimas 24h (para contextualizar a taxa de falha). */
  recentTotal: number
}

export function checkInngest(signals: InngestSignals): HealthResult {
  const base: Omit<HealthResult, 'status' | 'summary' | 'details'> = {
    integration: 'inngest',
    checkedAt: nowISO(),
  }

  const configured = Boolean(process.env.INNGEST_EVENT_KEY && process.env.INNGEST_SIGNING_KEY)
  if (!configured) {
    return {
      ...base,
      status: 'disconnected',
      summary: 'Não configurado',
      details: [{ label: 'Chaves Inngest', ok: false, message: 'INNGEST_EVENT_KEY/SIGNING_KEY ausentes.' }],
    }
  }

  const { recentFailures, recentTotal } = signals
  const failRate = recentTotal > 0 ? recentFailures / recentTotal : 0

  const details: HealthDetailCheck[] = [
    { label: 'Chaves configuradas', ok: true },
    {
      label: 'Execuções (24h)',
      ok: true,
      message: `${recentTotal} execução(ões), ${recentFailures} falha(s)`,
    },
  ]

  let status: HealthStatus = 'healthy'
  let summary = 'Operacional'
  if (recentFailures > 0 && failRate >= 0.5) {
    status = 'error'
    summary = 'Muitas falhas recentes'
    details.push({ label: 'Taxa de falha', ok: false, message: `${Math.round(failRate * 100)}%` })
  } else if (recentFailures > 0) {
    status = 'warning'
    summary = 'Algumas falhas recentes'
    details.push({ label: 'Taxa de falha', ok: null, message: `${Math.round(failRate * 100)}%` })
  }

  return { ...base, status, summary, details, meta: { recentFailures, recentTotal } }
}

// ---------------------------------------------------------------------------
// Supabase — banco + storage acessíveis
// ---------------------------------------------------------------------------

export interface SupabaseProbe {
  /** Executa um SELECT trivial; resolve true se o banco respondeu. */
  pingDb: () => Promise<boolean>
  /** Lista buckets; resolve true se o storage respondeu. */
  pingStorage: () => Promise<boolean>
}

export async function checkSupabase(probe: SupabaseProbe): Promise<HealthResult> {
  const base: Omit<HealthResult, 'status' | 'summary' | 'details'> = {
    integration: 'supabase',
    checkedAt: nowISO(),
  }

  const [dbOk, storageOk] = await Promise.all([
    probe.pingDb().catch(() => false),
    probe.pingStorage().catch(() => false),
  ])

  const details: HealthDetailCheck[] = [
    { label: 'Banco de dados', ok: dbOk },
    { label: 'Storage', ok: storageOk },
    // Realtime não é verificável de forma barata no servidor; reportamos como N/A.
    { label: 'Realtime', ok: null, message: 'Não verificado no servidor.' },
  ]

  const status: HealthStatus = dbOk && storageOk ? 'healthy' : dbOk || storageOk ? 'warning' : 'error'
  const summary =
    status === 'healthy' ? 'Operacional' : status === 'warning' ? 'Parcialmente degradado' : 'Indisponível'

  return { ...base, status, summary, details }
}
