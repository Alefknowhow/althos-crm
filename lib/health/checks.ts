/**
 * Integration health probes.
 *
 * Each probe is a pure-ish async function that performs a small, bounded
 * network/DB check and returns a typed {@link HealthResult}. They never throw:
 * any failure is captured and reported as a 'warning' or 'error' status with a
 * human-readable message, so the cron writer and the on-demand action can
 * always persist a row.
 *
 * Probes are intentionally cheap (single request, 8s timeout) because they run
 * for every org every 15 minutes.
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
function probeSignal(): AbortSignal {
  // AbortSignal.timeout is available on the Node 18+ / Edge runtimes Vercel uses.
  return AbortSignal.timeout(PROBE_TIMEOUT_MS)
}

function nowISO() {
  return new Date().toISOString()
}

/** Worst-status reducer: error > warning > disconnected > healthy. */
function rollup(checks: HealthDetailCheck[]): HealthStatus {
  if (checks.some(c => c.ok === false)) return 'error'
  if (checks.some(c => c.ok === null)) return 'warning'
  return 'healthy'
}

// ---------------------------------------------------------------------------
// WhatsApp (Meta Cloud API)
// ---------------------------------------------------------------------------

export interface WhatsappConfig {
  whatsapp_phone_number_id?: string | null
  whatsapp_access_token?: string | null
}

export async function checkWhatsapp(org: WhatsappConfig): Promise<HealthResult> {
  const base: Omit<HealthResult, 'status' | 'summary' | 'details'> = {
    integration: 'whatsapp',
    checkedAt: nowISO(),
  }

  const phoneId = org.whatsapp_phone_number_id
  const token = org.whatsapp_access_token

  if (!phoneId || !token) {
    return {
      ...base,
      status: 'disconnected',
      summary: 'Não conectado',
      details: [{ label: 'Número conectado', ok: false, message: 'Configure o WhatsApp em Configurações.' }],
    }
  }

  if (token === 'mock') {
    return {
      ...base,
      status: 'warning',
      summary: 'Modo simulação',
      details: [{ label: 'Token', ok: null, message: 'Token "mock" — mensagens não são enviadas de verdade.' }],
    }
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
      { headers: { Authorization: `Bearer ${token}` }, signal: probeSignal() },
    )

    if (res.ok) {
      const data: any = await res.json().catch(() => ({}))
      const details: HealthDetailCheck[] = [
        { label: 'Token válido', ok: true },
        { label: 'Número conectado', ok: true, message: data.display_phone_number || data.verified_name },
        {
          label: 'Qualidade do número',
          ok: data.quality_rating && data.quality_rating !== 'RED',
          message: data.quality_rating || 'desconhecida',
        },
      ]
      const status = rollup(details)
      return {
        ...base,
        status,
        summary: status === 'healthy' ? 'Conectado' : 'Conectado (atenção)',
        details,
        meta: { display_phone_number: data.display_phone_number, quality_rating: data.quality_rating },
      }
    }

    // Non-2xx → distinguish auth failure (expired token) from transient.
    const err: any = await res.json().catch(() => ({}))
    const isAuth = res.status === 401 || res.status === 403 || err?.error?.code === 190
    return {
      ...base,
      status: isAuth ? 'error' : 'warning',
      summary: isAuth ? 'Token expirado' : `Falha na API (${res.status})`,
      details: [
        { label: 'Token válido', ok: isAuth ? false : null, message: err?.error?.message },
        { label: 'Permissão de envio', ok: false },
      ],
      meta: { http_status: res.status, error: err?.error?.message },
    }
  } catch (e: any) {
    const aborted = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return {
      ...base,
      status: 'warning',
      summary: aborted ? 'Sem resposta (timeout)' : 'Erro ao verificar',
      details: [{ label: 'Conectividade Meta', ok: false, message: e?.message }],
      meta: { error: e?.message },
    }
  }
}

// ---------------------------------------------------------------------------
// Email (Resend) — verifica chave + status do domínio (SPF/DKIM/DMARC)
// ---------------------------------------------------------------------------

export interface EmailConfig {
  email_from_address?: string | null
}

export async function checkEmail(org: EmailConfig): Promise<HealthResult> {
  const base: Omit<HealthResult, 'status' | 'summary' | 'details'> = {
    integration: 'email',
    checkedAt: nowISO(),
  }

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    return {
      ...base,
      status: 'disconnected',
      summary: 'Resend não configurado',
      details: [{ label: 'Chave de API', ok: false, message: 'RESEND_API_KEY ausente no servidor.' }],
    }
  }

  // Estratégia A: todos os e-mails em nome dos clientes saem pelo domínio
  // compartilhado verificado, então é ele que verificamos aqui (não o
  // email_from_address por org, que deixou de ser usado no envio).
  const domain = process.env.RESEND_CLIENT_DOMAIN || 'send.althoscrm.com.br'
  const usesSharedSandbox = domain === 'resend.dev'

  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: probeSignal(),
    })

    if (res.status === 401) {
      return {
        ...base,
        status: 'error',
        summary: 'Chave de API inválida',
        details: [{ label: 'Chave de API', ok: false, message: 'Resend rejeitou a RESEND_API_KEY (401).' }],
        meta: { http_status: 401 },
      }
    }

    if (!res.ok) {
      return {
        ...base,
        status: 'warning',
        summary: `Falha na API (${res.status})`,
        details: [{ label: 'Conectividade Resend', ok: false }],
        meta: { http_status: res.status },
      }
    }

    const body: any = await res.json().catch(() => ({}))
    const domains: any[] = body?.data || []

    if (usesSharedSandbox) {
      return {
        ...base,
        status: 'warning',
        summary: 'Domínio compartilhado',
        details: [
          { label: 'Chave de API', ok: true },
          { label: 'Domínio próprio', ok: null, message: 'Usando onboarding@resend.dev — configure um domínio próprio para melhor entregabilidade.' },
        ],
        meta: { domain },
      }
    }

    const match = domains.find(d => d?.name === domain)
    if (!match) {
      return {
        ...base,
        status: 'warning',
        summary: 'Domínio não encontrado',
        details: [
          { label: 'Chave de API', ok: true },
          { label: `Domínio ${domain}`, ok: false, message: 'Não está cadastrado no Resend.' },
        ],
        meta: { domain },
      }
    }

    // Resend's domain record exposes per-record status (spf/dkim/dmarc) under records[].
    const records: any[] = match.records || []
    const recStatus = (type: string) => {
      const r = records.find(x => String(x?.record || x?.type || '').toUpperCase().includes(type))
      return r?.status ? String(r.status).toLowerCase() === 'verified' : null
    }
    const verified = match.status === 'verified'
    const details: HealthDetailCheck[] = [
      { label: 'Chave de API', ok: true },
      { label: 'Domínio validado', ok: verified, message: match.status },
      { label: 'SPF', ok: recStatus('SPF') },
      { label: 'DKIM', ok: recStatus('DKIM') },
      { label: 'DMARC', ok: recStatus('DMARC') },
    ]
    const status: HealthStatus = verified ? rollup(details) : 'error'
    return {
      ...base,
      status,
      summary: verified ? 'Domínio verificado' : 'Domínio não verificado',
      details,
      meta: { domain, domain_status: match.status },
    }
  } catch (e: any) {
    const aborted = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return {
      ...base,
      status: 'warning',
      summary: aborted ? 'Sem resposta (timeout)' : 'Erro ao verificar',
      details: [{ label: 'Conectividade Resend', ok: false, message: e?.message }],
      meta: { error: e?.message },
    }
  }
}

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
