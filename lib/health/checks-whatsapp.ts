/**
 * WhatsApp (Meta Cloud API) health probe. Split out of lib/health/checks.ts.
 */

import { probeSignal, nowISO, rollup, type HealthResult, type HealthDetailCheck } from './checks-shared'

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
      `https://graph.facebook.com/v26.0/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name,quality_rating,messaging_limit_tier`,
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
