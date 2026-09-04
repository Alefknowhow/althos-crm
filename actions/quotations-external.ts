'use server'

import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkMemberPermission } from '@/lib/permissions.server'

/* ─────────── TripAdvisor (Terra API — terra.tripadvisor.com, cacheado na montagem) ───────────
 * A API antiga (api.content.tripadvisor.com, autenticada via ?key=) está sendo descontinuada.
 * A Terra API usa outro host e autentica por header X-API-Key. */
const TRIPADVISOR_BASE = 'https://terra.tripadvisor.com/api'

function taHeaders(key: string) {
  return { Accept: 'application/json', 'X-API-Key': key }
}

/** Extrai o texto na localidade preferida (pt) de uma lista de Translation[], com fallback pro primeiro item. */
function pickTranslation(items: any[] | undefined, preferred = 'pt'): string | undefined {
  if (!Array.isArray(items) || items.length === 0) return undefined
  return items.find(i => i?.language === preferred)?.value || items[0]?.value
}

export async function tripadvisorLookup(orgSlug: string, query: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }

  const key = process.env.TRIPADVISOR_API_KEY
  if (!key) {
    return { ok: false as const, error: 'TripAdvisor não configurado. Adicione TRIPADVISOR_API_KEY nas variáveis de ambiente.' }
  }
  const q = (query || '').trim()
  if (!q) return { ok: false as const, error: 'Digite o nome do hotel' }

  try {
    const search = await fetch(
      `${TRIPADVISOR_BASE}/catalog/locations/search?query=${encodeURIComponent(q)}&category=HOTEL&locale=pt-BR&size=1`,
      { headers: taHeaders(key), cache: 'no-store' },
    )
    if (!search.ok) return { ok: false as const, error: `TripAdvisor indisponível (${search.status})` }
    const sr = await search.json()
    const loc = sr?.data?.[0]?.location
    if (!loc?.id) return { ok: false as const, error: 'Hotel não encontrado no TripAdvisor' }

    const photoRes = await fetch(
      `${TRIPADVISOR_BASE}/locations/${loc.id}/photos?locale=pt-BR&size=10`,
      { headers: taHeaders(key), cache: 'no-store' },
    )
    const photosJson = photoRes.ok ? await photoRes.json() : { data: [] }

    const data = {
      rating: loc.overall_rating?.rating ? Number(loc.overall_rating.rating) : undefined,
      reviews_count: loc.overall_rating?.count ? Number(loc.overall_rating.count) : undefined,
      url: loc.urls?.official || loc.urls?.tripadvisor?.main || undefined,
      photos: Array.isArray(photosJson?.data)
        ? photosJson.data.map((p: any) => p?.photo?.original_size_url).filter(Boolean)
        : [],
      lat: loc.coordinates?.latitude != null ? Number(loc.coordinates.latitude) : undefined,
      lng: loc.coordinates?.longitude != null ? Number(loc.coordinates.longitude) : undefined,
      address: pickTranslation(loc.addresses?.map((a: any) => ({ language: a.language, value: a.formatted }))),
      description: pickTranslation(loc.descriptions),
    }
    return {
      ok: true as const,
      location_id: String(loc.id),
      name: pickTranslation(loc.names) || q,
      data,
    }
  } catch {
    return { ok: false as const, error: 'Erro ao consultar o TripAdvisor. Tente novamente.' }
  }
}

/* ─────────── Unsplash (busca de foto de capa) ─────────── */
export async function unsplashSearch(orgSlug: string, query: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const, error: perm.reason || 'Sem permissão' }

  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key) {
    return { ok: false as const, error: 'Unsplash não configurado. Adicione UNSPLASH_ACCESS_KEY nas variáveis de ambiente.' }
  }
  const q = (query || '').trim()
  if (!q) return { ok: false as const, error: 'Digite o que buscar (ex.: nome do destino)' }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=12&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` }, cache: 'no-store' },
    )
    if (!res.ok) return { ok: false as const, error: `Unsplash indisponível (${res.status})` }
    const json = await res.json()
    const results = Array.isArray(json?.results) ? json.results : []
    return {
      ok: true as const,
      photos: results.map((p: any) => ({
        id: p.id as string,
        thumbUrl: p.urls?.small as string,
        fullUrl: (p.urls?.regular || p.urls?.full) as string,
        downloadLocation: p.links?.download_location as string,
        author: p.user?.name as string,
        authorUrl: p.user?.links?.html as string,
      })).filter((p: any) => p.thumbUrl && p.fullUrl),
    }
  } catch {
    return { ok: false as const, error: 'Erro ao consultar o Unsplash. Tente novamente.' }
  }
}

/** Aciona o endpoint de download da Unsplash (obrigatório pelos termos de uso ao usar uma foto). */
export async function unsplashTrackDownload(orgSlug: string, downloadLocation: string) {
  const user = await requireAuth()
  const org = await getCurrentOrganization(orgSlug)
  const perm = await checkMemberPermission(org.id, user.id, 'cotacoes')
  if (!perm.allowed) return { ok: false as const }
  const key = process.env.UNSPLASH_ACCESS_KEY
  if (!key || !downloadLocation) return { ok: false as const }
  try {
    await fetch(downloadLocation, { headers: { Authorization: `Client-ID ${key}` }, cache: 'no-store' })
    return { ok: true as const }
  } catch {
    return { ok: false as const }
  }
}
