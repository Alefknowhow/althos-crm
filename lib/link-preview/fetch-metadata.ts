/**
 * Extrai metadados Open Graph (título, descrição, imagem) de uma URL
 * pra montar a prévia de link nas mensagens do WhatsApp — igual o
 * WhatsApp de verdade mostra. Server-only: quem chama isso do lado do
 * client é sempre via actions/link-preview.ts.
 */

const FETCH_TIMEOUT_MS = 6000
const MAX_HTML_BYTES = 512 * 1024 // 512KB é de sobra pra achar as tags <meta> no <head>
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

/** Bloqueia URL apontando pra rede interna/loopback — a extração roda
 *  server-side (função serverless da Vercel), então uma URL vinda de
 *  mensagem de WhatsApp (conteúdo de terceiro, não confiável) não pode
 *  virar um SSRF pra rede interna ou pro endpoint de metadados de nuvem
 *  (169.254.169.254). Checagem por literal de hostname — não resolve
 *  DNS, então não cobre um domínio que resolve pra IP interno, mas
 *  fecha o vetor mais óbvio (URL com IP literal).
 */
function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (/^127\./.test(h) || h === '::1') return true
  if (/^169\.254\./.test(h)) return true
  if (/^10\./.test(h)) return true
  if (/^192\.168\./.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true
  if (/^0\.0\.0\.0$/.test(h)) return true
  return false
}

export function isFetchableUrl(rawUrl: string): boolean {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (isBlockedHost(u.hostname)) return false
    return true
  } catch {
    return false
  }
}

function extractMeta(html: string, prop: string): string | null {
  // Aceita og:title="..." ou name="og:title" antes/depois de content, em
  // qualquer ordem de atributo — páginas reais variam bastante nisso.
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']|<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`,
    'i',
  )
  const m = html.match(re)
  const val = m?.[1] ?? m?.[2]
  return val ? val.trim() : null
}

export type LinkMetadata = {
  title: string | null
  description: string | null
  siteName: string | null
  imageUrl: string | null
}

/** Baixa só o começo do HTML (até MAX_HTML_BYTES) e extrai as tags OG do
 *  <head> — não precisa (nem deveria) baixar a página inteira. */
export async function fetchOgMetadata(url: string): Promise<LinkMetadata | null> {
  if (!isFetchableUrl(url)) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlthosCRM-LinkPreview/1.0)' },
    })
    if (!res.ok || !res.body) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.includes('text/html')) return null

    const reader = res.body.getReader()
    let received = 0
    const chunks: Uint8Array[] = []
    while (received < MAX_HTML_BYTES) {
      const { done, value } = await reader.read()
      if (done) break
      if (value) { chunks.push(value); received += value.byteLength }
    }
    try { await reader.cancel() } catch { /* best-effort */ }

    const html = Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf-8')
    const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || null

    const imageRaw = extractMeta(html, 'og:image') || extractMeta(html, 'twitter:image')
    const imageUrl = imageRaw ? new URL(imageRaw, url).toString() : null

    return {
      title: extractMeta(html, 'og:title') || titleTag,
      description: extractMeta(html, 'og:description') || extractMeta(html, 'description'),
      siteName: extractMeta(html, 'og:site_name') || new URL(url).hostname,
      imageUrl,
    }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

/** Baixa os bytes de uma imagem de prévia já vetada (veio de um og:image
 *  extraído por fetchOgMetadata acima, nunca de input direto do usuário)
 *  — usado pelo proxy de imagem (app/api/link-preview-image), que nunca
 *  repassa uma URL arbitrária pro navegador buscar direto (evitaria o
 *  CSP e vazaria a URL de terceiro pro cliente). */
export async function fetchPreviewImage(url: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!isFetchableUrl(url)) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    if (!contentType.startsWith('image/')) return null
    const buf = Buffer.from(await res.arrayBuffer())
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null
    return { bytes: buf, contentType: contentType.split(';')[0].trim() }
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}
