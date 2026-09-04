/**
 * Email (Resend) health probe — verifica chave + status do domínio
 * (SPF/DKIM/DMARC). Split out of lib/health/checks.ts.
 */

import { probeSignal, nowISO, rollup, type HealthResult, type HealthDetailCheck, type HealthStatus } from './checks-shared'

export interface EmailConfig {
  email_from_address?: string | null
}

export async function checkEmail(_org: EmailConfig): Promise<HealthResult> {
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

    // The LIST endpoint (GET /domains) omits the per-record array, so SPF/DKIM/
    // DMARC status isn't available there. Fetch the single-domain endpoint to
    // read records[] and report each record's real status.
    let records: any[] = Array.isArray(match.records) ? match.records : []
    if (records.length === 0 && match.id) {
      const detailRes = await fetch(`https://api.resend.com/domains/${match.id}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: probeSignal(),
      }).catch(() => null)
      if (detailRes?.ok) {
        const detailBody: any = await detailRes.json().catch(() => ({}))
        if (Array.isArray(detailBody?.records)) records = detailBody.records
      }
    }

    // Each Resend record carries `record: 'SPF' | 'DKIM' | 'DMARC'` and a
    // `status`. A type can map to several records (e.g. DKIM uses 3 CNAMEs) —
    // require ALL of them verified. Returns null when no such record exists.
    const recStatus = (type: string): boolean | null => {
      const matches = records.filter(
        x => String(x?.record || x?.type || '').toUpperCase().includes(type),
      )
      if (matches.length === 0) return null
      return matches.every(m => String(m?.status || '').toLowerCase() === 'verified')
    }

    const verified = match.status === 'verified'
    const spf = recStatus('SPF')
    const dkim = recStatus('DKIM')
    const dmarc = recStatus('DMARC')

    // SPF + DKIM são obrigatórios para entregabilidade e definem a saúde do
    // card. DMARC é opcional no Resend (não é criado automaticamente), então é
    // só informativo — sua ausência não rebaixa o status.
    const coreDetails: HealthDetailCheck[] = [
      { label: 'Chave de API', ok: true },
      { label: 'Domínio validado', ok: verified, message: match.status },
      { label: 'SPF', ok: spf },
      { label: 'DKIM', ok: dkim },
    ]
    const details: HealthDetailCheck[] = [
      ...coreDetails,
      {
        label: 'DMARC',
        ok: dmarc,
        message: dmarc === null ? 'opcional — não configurado' : undefined,
      },
    ]
    const status: HealthStatus = verified ? rollup(coreDetails) : 'error'
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
