import { NextResponse, type NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { getCallerIp } from '@/lib/security/antispam'

export const dynamic = 'force-dynamic'

const VISITOR_COOKIE = '_ttrk'
const VISITOR_COOKIE_MAX_AGE = 90 * 24 * 3600 // 90 dias

// UTMs/referrer/user-agent vêm direto da query string/headers de um
// visitante anônimo — sem cap, um payload malicioso pode inflar
// tracking_clicks com strings enormes (achado 1.5 da auditoria de
// segurança). Limites generosos o bastante pra UTM legítimo, curtos o
// bastante pra não valer a pena abusar.
const MAX_UTM_LEN = 255
const MAX_HEADER_LEN = 512

function capLen(value: string | null, max: number): string | null {
  if (!value) return null
  return value.slice(0, max)
}

/**
 * Redirect de rastreamento próprio — registra o clique ANTES de mandar o
 * visitante pro destino. Ver plano em
 * C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md.
 *
 * Sem auth (rota pública por natureza — quem clica é um visitante anônimo).
 * Grava via admin client, mesmo padrão de public_forms.ts — tracking_clicks
 * não tem policy de anon/authenticated pra INSERT.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const url = new URL(req.url)
  const admin = createAdminClient()

  const { data: link } = await admin
    .from('tracking_links')
    .select('id, organization_id, destination_url')
    .eq('code', params.code)
    .maybeSingle()

  // Código inválido: nunca vaza se existe ou não — só manda pra home.
  if (!link) return NextResponse.redirect(new URL('/', url.origin))

  let destination: URL
  try {
    destination = new URL(link.destination_url)
  } catch {
    destination = new URL('/', url.origin)
  }

  const existingVisitorId = req.cookies.get(VISITOR_COOKIE)?.value
  const visitorId = existingVisitorId || crypto.randomUUID()

  const fbclid = url.searchParams.get('fbclid')
  // Formato documentado pela Meta pro cookie _fbc: fb.1.<timestamp_ms>.<fbclid>.
  // Sintetizamos aqui porque o clique acontece no NOSSO domínio, antes do
  // pixel do Facebook rodar em qualquer página — não tem cookie _fbc real
  // ainda nesse momento. Serve de fallback pro CAPI quando o cookie do
  // pixel não chegar até a conversão (bloqueio de cookie, pixel lento etc.).
  const syntheticFbc = fbclid ? `fb.1.${Date.now()}.${fbclid}` : null

  await admin.from('tracking_clicks').insert({
    link_id: link.id,
    organization_id: link.organization_id,
    visitor_id: visitorId,
    ip: getCallerIp(),
    user_agent: capLen(req.headers.get('user-agent'), MAX_HEADER_LEN),
    referrer: capLen(req.headers.get('referer'), MAX_HEADER_LEN),
    utm_source: capLen(url.searchParams.get('utm_source'), MAX_UTM_LEN),
    utm_medium: capLen(url.searchParams.get('utm_medium'), MAX_UTM_LEN),
    utm_campaign: capLen(url.searchParams.get('utm_campaign'), MAX_UTM_LEN),
    utm_content: capLen(url.searchParams.get('utm_content'), MAX_UTM_LEN),
    utm_term: capLen(url.searchParams.get('utm_term'), MAX_UTM_LEN),
    gclid: capLen(url.searchParams.get('gclid'), MAX_UTM_LEN),
    fbclid: capLen(fbclid, MAX_UTM_LEN),
    fbc: syntheticFbc,
  })

  await admin.rpc('increment_tracking_link_clicks', { p_link_id: link.id })

  const res = NextResponse.redirect(destination)
  if (!existingVisitorId) {
    res.cookies.set(VISITOR_COOKIE, visitorId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: '/',
    })
  }
  return res
}
