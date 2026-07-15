'use client'

/**
 * Proposta pública de viagem — réplica do design handoff
 * `proposta-viagem-althos.html` (concierge editorial: Lora + Inter,
 * navy/gold/ivory, blocos retráteis, countdown, mapa Leaflet, modal do
 * hotel com dados cacheados do TripAdvisor).
 *
 * Também é usada como preview ao vivo dentro do editor (prop `preview`):
 * nesse modo não dispara eventos de tracking e campos vazios viram o
 * marcador [A CONFIRMAR].
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import 'leaflet/dist/leaflet.css'

/* ─────────────────────── tipos (contrato da RPC) ─────────────────────── */
export type QuotationOrg = {
  legal_name?: string | null
  brand_logo_url?: string | null
  brand_accent?: string | null
  instagram_url?: string | null
  site_url?: string | null
  terms_url?: string | null
  privacy_url?: string | null
  whatsapp_number?: string | null
  city_state?: string | null
  cnpj?: string | null
  cadastur?: string | null
}

export type QuotationLodging = {
  id?: string
  name?: string | null
  check_in?: string | null
  check_out?: string | null
  room_category?: string | null
  board?: string | null
  description_html?: string | null
  photos?: string[]
  lat?: number | null
  lng?: number | null
  tripadvisor_data?: {
    rating?: number
    reviews_count?: number
    url?: string
    photos?: string[]
    lat?: number
    lng?: number
    address?: string
  } | null
}

export type QuotationFlight = {
  id?: string
  leg_type?: string | null
  from_code?: string | null
  from_city?: string | null
  to_code?: string | null
  to_city?: string | null
  airline?: string | null
  date?: string | null
  duration_label?: string | null
  stopover_label?: string | null
  baggage?: string[]
  cabin_class?: string | null
}

export type QuotationDay = {
  id?: string
  day_label?: string | null
  date?: string | null
  title?: string | null
  items?: string[]
}

export type QuotationPin = { label?: string; type?: string; lat: number; lng: number }

export type PublicQuotation = {
  id?: string
  status?: string
  expired?: boolean
  client_name?: string | null
  title?: string | null
  subtitle?: string | null
  cover_image_url?: string | null
  origin_label?: string | null
  origin_note?: string | null
  destinations?: { name?: string; country?: string }[]
  departure_date?: string | null
  return_date?: string | null
  pax_adults?: number
  pax_children?: number
  children_ages?: number[]
  occupancy_label?: string | null
  intro_html?: string | null
  important_html?: string | null
  closing_html?: string | null
  cancellation_html?: string | null
  itinerary_html?: string | null
  included?: string[]
  not_included?: string[]
  price_per_person_cents?: number | null
  total_cents?: number | null
  currency?: string | null
  payment_conditions?: { label?: string; value?: string }[]
  price_disclaimer?: string | null
  quoted_at?: string | null
  validity_days?: number | null
  lodgings?: QuotationLodging[]
  flights?: QuotationFlight[]
  itinerary_days?: QuotationDay[]
  map_pins?: QuotationPin[]
  org?: QuotationOrg
}

/* ─────────────────────── helpers ─────────────────────── */
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function d(iso?: string | null): Date | null {
  if (!iso) return null
  const dt = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return Number.isNaN(dt.getTime()) ? null : dt
}
function fmtShort(iso?: string | null): string {
  const dt = d(iso)
  return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : ''
}
function fmtDayMonth(iso?: string | null): string {
  const dt = d(iso)
  return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]}` : ''
}
function fmtBr(iso?: string | null): string {
  const dt = d(iso)
  return dt ? dt.toLocaleDateString('pt-BR') : ''
}
function brl(cents?: number | null): string {
  if (cents == null) return ''
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v % 1 === 0 ? 0 : 2 })
}
function nightsBetween(a?: string | null, b?: string | null): number | null {
  const da = d(a); const db = d(b)
  if (!da || !db) return null
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000))
}

const PIN_COLORS: Record<string, string> = {
  lodging: '#B8924B', attraction: '#0e5d63', airport: '#1c2530', custom: '#0e5d63',
}
const LEG_LABELS: Record<string, string> = { outbound: 'Ida', inbound: 'Volta', connection: 'Conexão' }

export const BAGGAGE_OPTIONS = [
  { key: 'item_pessoal', label: 'Item pessoal (mochila)' },
  { key: 'mao', label: 'Bagagem de mão (10 kg)' },
  { key: 'despachada', label: 'Bagagem despachada (23 kg)' },
] as const
export const CABIN_LABELS: Record<string, string> = {
  economica: 'Econômica', premium: 'Premium Economy', executiva: 'Executiva', primeira: 'Primeira Classe',
}

/** HTML "vazio" do editor (ex.: <p></p>) não conta como conteúdo. */
function hasHtml(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim() !== '' || /<img/i.test(html)
}

/** HTML rico do agente, sanitizado no cliente antes de renderizar. */
function Rich({ html, className }: { html?: string | null; className?: string }) {
  const [clean, setClean] = useState('')
  useEffect(() => {
    let on = true
    if (!html) { setClean(''); return }
    import('dompurify').then(m => { if (on) setClean(m.default.sanitize(html)) })
    return () => { on = false }
  }, [html])
  if (!clean) return null
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

/* ─────────────────────── ícones (inline, iguais ao anexo) ─────────────────────── */
const IcPin = () => <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></svg>
const IcGlobe = ({ className = 'ic' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>
const IcCal = () => <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
const IcChev = () => <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
const IcPlane = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19h19v2h-19zM22 9.5c-.3-1-1.4-1.6-2.4-1.3l-4.7 1.3-6-5.6-1.8.5 3.6 6.2-4.4 1.2-1.7-1.4-1.4.4L5 15l14-3.8c1-.3 1.6-1.4 1.3-2.4z" /></svg>
const IcExt = () => <svg className="link-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8" /></svg>
const IcWa = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.5-4-.1-.2-1-1.4-1-2.6s.6-1.8.8-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.7 1.8c.1.2.1.4 0 .5l-.3.5-.3.4c-.1.1-.2.3-.1.5s.5.9 1.1 1.4c.8.7 1.4.9 1.6 1s.3.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" /></svg>
const IcChat = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>
const IcIg = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
const IcImg = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
const IcBackpack = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5M8 10h8" /></svg>
const IcCarryon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="7" width="12" height="14" rx="2" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M10 11v6M14 11v6" /></svg>
const IcSuitcase = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 10v6M16 10v6M12 10v6" /></svg>
const BAGGAGE_ICONS: Record<string, () => JSX.Element> = {
  item_pessoal: IcBackpack, mao: IcCarryon, despachada: IcSuitcase,
}

/* ─────────────────────── imagem com fade + fallback ─────────────────────── */
function LazyImg({ src, alt = '', className }: { src?: string | null; alt?: string; className?: string }) {
  const [ok, setOk] = useState(false)
  const [err, setErr] = useState(false)
  useEffect(() => {
    if (!src) return
    let on = true
    const probe = new Image()
    probe.onload = () => { if (on) setOk(true) }
    probe.onerror = () => { if (on) setErr(true) }
    probe.src = src
    return () => { on = false }
  }, [src])
  if (!src || err) return null
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={ok ? src : undefined} alt={alt} className={`${className || ''}${ok ? ' loaded' : ''}`} />
}

/* ─────────────────────── lightbox (ampliar foto) ─────────────────────── */
function Lightbox({
  photos, index, onIndex, onClose,
}: { photos: string[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const prev = () => onIndex((index - 1 + photos.length) % photos.length)
  const next = () => onIndex((index + 1) % photos.length)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowLeft') prev()
      else if (e.key === 'ArrowRight') next()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, photos.length])
  return (
    <div className="pp-lb" role="dialog" aria-modal="true" onClick={onClose}>
      <button className="pp-lb-close" onClick={onClose} aria-label="Fechar">×</button>
      {photos.length > 1 && <button className="pp-lb-nav left" onClick={e => { e.stopPropagation(); prev() }} aria-label="Anterior">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
      </button>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photos[index]} alt="" className="pp-lb-img" onClick={e => e.stopPropagation()} />
      {photos.length > 1 && <button className="pp-lb-nav right" onClick={e => { e.stopPropagation(); next() }} aria-label="Próxima">
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
      </button>}
      {photos.length > 1 && <div className="pp-lb-count">{index + 1} / {photos.length}</div>}
    </div>
  )
}

/* ─────────────────────── bloco retrátil ─────────────────────── */
function Block({
  num, title, sub, defaultOpen = false, onFirstOpen, children,
}: {
  num: string; title: string; sub?: string; defaultOpen?: boolean
  onFirstOpen?: () => void; children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const opened = useRef(defaultOpen)
  const bodyRef = useRef<HTMLDivElement>(null)
  const [maxH, setMaxH] = useState<string>(defaultOpen ? 'none' : '0px')

  const sync = useCallback(() => {
    if (bodyRef.current) setMaxH(bodyRef.current.scrollHeight + 'px')
  }, [])

  useEffect(() => {
    if (defaultOpen && onFirstOpen) onFirstOpen()
    if (defaultOpen) requestAnimationFrame(sync)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function toggle() {
    const next = !open
    setOpen(next)
    if (next) {
      if (!opened.current) { opened.current = true; onFirstOpen?.() }
      sync()
      setTimeout(sync, 300)
      setTimeout(() => setMaxH('none'), 500)
    } else {
      // fecha a partir da altura real para a transição funcionar
      sync()
      requestAnimationFrame(() => setMaxH('0px'))
    }
  }

  return (
    <section className={`block${open ? ' open' : ''}`}>
      <button type="button" className="block-head" aria-expanded={open} onClick={toggle}>
        <span className="num">{num}</span>
        <span className="bt"><h3>{title}</h3>{sub && <div className="sub">{sub}</div>}</span>
        <IcChev />
      </button>
      {/* maxHeight 'none' precisa ir explícito no inline style — se cair no
          CSS base (max-height:0) o bloco recolhe sozinho depois de abrir */}
      <div className="block-body" ref={bodyRef} style={{ maxHeight: maxH, overflow: maxH === 'none' ? 'visible' : undefined }}>
        <div className="block-inner">{children}</div>
      </div>
    </section>
  )
}

/* ─────────────────────── reveal on scroll ─────────────────────── */
function useReveal(rootRef: React.RefObject<HTMLDivElement>) {
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') })
    }, { threshold: 0.12 })
    root.querySelectorAll('.reveal').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [rootRef])
}

/* ═══════════════════════ componente principal ═══════════════════════ */
export default function PublicQuotationView({
  data, preview = false,
}: { data: PublicQuotation; preview?: boolean }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<HTMLDivElement>(null)
  const mapObj = useRef<any>(null)
  const miniMapRef = useRef<HTMLDivElement>(null)
  const [modalLodge, setModalLodge] = useState<QuotationLodging | null>(null)
  const [lightbox, setLightbox] = useState<{ photos: string[]; index: number } | null>(null)

  const org = data.org || {}
  const AC = '[A CONFIRMAR]'
  const t = (v?: string | null, fallback = '') => v || (preview ? AC : fallback)

  const lodgings = data.lodgings || []
  const flights = data.flights || []
  const days = data.itinerary_days || []
  const included = data.included || []
  const notIncluded = data.not_included || []
  const paymentConditions = (data.payment_conditions || []).filter(p => p?.label || p?.value)
  const destinations = Array.isArray(data.destinations) ? data.destinations.filter(x => x?.name) : []

  const paxTotal = (data.pax_adults || 0) + (data.pax_children || 0)
  const nights = nightsBetween(data.departure_date, data.return_date)
  const daysCount = nights != null ? nights + 1 : null

  // pins: tabela de pins + hospedagens com coordenadas
  const pins: QuotationPin[] = useMemo(() => {
    const fromLodgings = lodgings
      .filter(l => l.lat != null && l.lng != null)
      .map(l => ({ label: l.name || 'Hospedagem', type: 'lodging', lat: l.lat!, lng: l.lng! }))
    const explicit = (data.map_pins || []).filter(p => p && p.lat != null && p.lng != null)
    // evita pin duplicado da hospedagem quando também existe na tabela
    const seen = new Set(explicit.map(p => `${p.lat},${p.lng}`))
    return [...explicit, ...fromLodgings.filter(p => !seen.has(`${p.lat},${p.lng}`))]
  }, [data.map_pins, lodgings])

  const pinTypes = Array.from(new Set(pins.map(p => p.type || 'attraction')))

  // countdown
  const [cd, setCd] = useState<string>('–')
  useEffect(() => {
    const dep = d(data.departure_date)
    if (!dep) { setCd(preview ? '–' : '✈'); return }
    const diff = Math.ceil((dep.getTime() - Date.now()) / 86400000)
    setCd(diff > 0 ? String(diff) : '✈')
  }, [data.departure_date, preview])

  useReveal(rootRef)

  /* tracking (só no link real) */
  useEffect(() => {
    if (preview || data.expired) return
    const key = `alq_viewed_${data.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { /* sessionStorage indisponível não impede o tracking */ }
    const token = window.location.pathname.split('/').pop()
    fetch('/api/track/proposal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: 'viewed' }),
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const trackCta = useCallback((type: 'reservar' | 'duvidas') => {
    if (preview) return
    const token = window.location.pathname.split('/').pop()
    fetch('/api/track/proposal', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: 'cta_clicked', cta: type }),
    }).catch(() => {})
  }, [preview])

  /* mapa — inicializa só na primeira expansão */
  const initMap = useCallback(() => {
    if (mapObj.current || pins.length === 0) return
    setTimeout(async () => {
      if (mapObj.current || !mapRef.current) return
      const L = (await import('leaflet')).default
      if (mapObj.current || !mapRef.current) return
      const map = L.map(mapRef.current, { scrollWheelZoom: false })
      mapObj.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map)
      const mk = (color: string) => L.divIcon({
        className: '',
        html: `<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:${color};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.4)"></div>`,
        iconSize: [18, 18], iconAnchor: [9, 18],
      })
      const g: [number, number][] = []
      pins.forEach(p => {
        L.marker([p.lat, p.lng], { icon: mk(PIN_COLORS[p.type || 'attraction'] || '#0e5d63') })
          .addTo(map).bindPopup(`<b>${(p.label || '').replace(/</g, '&lt;')}</b>`)
        g.push([p.lat, p.lng])
      })
      if (g.length > 1) map.fitBounds(g, { padding: [40, 40] })
      else if (g.length === 1) map.setView(g[0], 12)
      setTimeout(() => map.invalidateSize(), 80)
    }, 260)
  }, [pins])

  useEffect(() => () => { mapObj.current?.remove(); mapObj.current = null }, [])

  /* modal do hotel */
  const openHotel = useCallback((l: QuotationLodging) => {
    if (!l.tripadvisor_data) return
    setModalLodge(l)
    document.body.style.overflow = 'hidden'
  }, [])
  const closeHotel = useCallback(() => {
    setModalLodge(null)
    document.body.style.overflow = ''
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeHotel() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeHotel])
  useEffect(() => {
    if (!modalLodge || !miniMapRef.current) return
    const lat = modalLodge.tripadvisor_data?.lat ?? modalLodge.lat
    const lng = modalLodge.tripadvisor_data?.lng ?? modalLodge.lng
    if (lat == null || lng == null) return
    let mm: any
    const timer = setTimeout(async () => {
      const L = (await import('leaflet')).default
      if (!miniMapRef.current || miniMapRef.current.dataset.ready) return
      miniMapRef.current.dataset.ready = '1'
      mm = L.map(miniMapRef.current, { zoomControl: false, scrollWheelZoom: false, dragging: false }).setView([lat, lng], 14)
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mm)
      L.marker([lat, lng]).addTo(mm)
      setTimeout(() => mm.invalidateSize(), 80)
    }, 200)
    return () => { clearTimeout(timer); mm?.remove(); if (miniMapRef.current) delete miniMapRef.current.dataset.ready }
  }, [modalLodge])

  /* WhatsApp */
  const waDigits = (org.whatsapp_number || '').replace(/\D/g, '')
  const waNumber = waDigits ? (waDigits.length <= 11 ? `55${waDigits}` : waDigits) : ''
  const waHref = (msg: string) => `https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`

  /* accent white-label */
  const accentStyle = org.brand_accent
    ? ({ ['--gold' as any]: org.brand_accent, ['--gold-soft' as any]: org.brand_accent } as React.CSSProperties)
    : undefined

  /* estado expirado */
  if (data.expired && !preview) {
    return (
      <div className="alq" ref={rootRef} style={accentStyle}>
        <style>{CSS}</style>
        <div className="expired-wrap">
          <div className="expired-card">
            <div className="eyebrow">Proposta expirada</div>
            <h1>Esta cotação não está mais válida</h1>
            <p>Tarifas de viagem mudam rápido. Fale com a gente para atualizar os valores — leva poucos minutos.</p>
            {waNumber && (
              <a className="btn btn-primary" href={waHref(`Olá! A proposta "${data.title || 'de viagem'}" expirou — pode atualizar os valores pra mim?`)} target="_blank" rel="noopener noreferrer">
                <IcWa /> Falar com a agência
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  /* numeração dinâmica dos blocos visíveis */
  let n = 0
  const num = () => String(++n).padStart(2, '0')

  return (
    <div className="alq" ref={rootRef} style={accentStyle}>
      <style>{CSS}</style>

      {/* ───── HERO ───── */}
      <header className="hero">
        <LazyImg src={data.cover_image_url} alt={data.title || 'Viagem'} />
        <div className="countdown">
          <div className="cd-num">{cd}</div>
          <div className="cd-lbl">dias para embarcar</div>
          <div className="cd-date">{fmtShort(data.departure_date) || (preview ? AC : '')}</div>
        </div>
        <div className="hero-inner">
          <div className="eyebrow">Proposta exclusiva{data.client_name ? ` · ${data.client_name}` : (preview ? ` · ${AC}` : '')}</div>
          <h1>{t(data.title, 'Proposta de viagem')}</h1>
          {(data.subtitle || preview) && <h2>{t(data.subtitle)}</h2>}
          {(paxTotal > 0 || data.occupancy_label) && (
            <div className="hero-meta">
              {paxTotal > 0 && <>{paxTotal} {paxTotal > 1 ? 'pessoas' : 'pessoa'}</>}
              {paxTotal > 0 && data.occupancy_label && ' · '}
              {data.occupancy_label}
            </div>
          )}
        </div>
      </header>

      <main className="wrap">
        {/* ───── 3 CARDS ───── */}
        <section className="facts reveal">
          <div className="fact">
            <IcPin />
            <div className="k">Saída</div>
            <div className="v">{t(data.origin_label)}{(data.origin_note || preview) && <small>{t(data.origin_note)}</small>}</div>
          </div>
          <div className="fact">
            <IcGlobe />
            <div className="k">Destino</div>
            <div className="v">
              {destinations[0]?.name || (preview ? AC : '—')}
              {(destinations[0]?.country || destinations.length > 1) && (
                <small>{[destinations[0]?.country, destinations.slice(1).map(x => x.name).join(' · ')].filter(Boolean).join(' · ')}</small>
              )}
            </div>
          </div>
          <div className="fact">
            <IcCal />
            <div className="k">Período</div>
            <div className="v">
              {fmtShort(data.departure_date) || (preview ? AC : '—')}
              {daysCount != null && <small>{daysCount} dias · {nights} noites</small>}
            </div>
          </div>
        </section>

        {/* ───── INTRO (só quando tem conteúdo real) ───── */}
        {hasHtml(data.intro_html) && (
          <section className="intro reveal">
            <Rich html={data.intro_html} />
            <div className="sig">
              <span>{org.legal_name || ''}</span>
            </div>
          </section>
        )}

        {/* ───── HOSPEDAGEM ───── */}
        {lodgings.length > 0 && (
          <Block num={num()} title="Hospedagem" defaultOpen
            sub={`${lodgings.length} ${lodgings.length > 1 ? 'opções' : lodgings[0].board ? `${lodgings[0].board.toLowerCase()}` : 'hospedagem'}${nights ? ` · ${nights} noites` : ''}`}>
            {lodgings.map((l, i) => {
              const ln = nightsBetween(l.check_in, l.check_out)
              const clickable = !!l.tripadvisor_data
              return (
                <div key={l.id || i} className="lodge">
                  {clickable ? (
                    <a className="name" role="button" tabIndex={0} onClick={() => openHotel(l)}
                      onKeyDown={e => { if (e.key === 'Enter') openHotel(l) }}>
                      {l.name || 'Hospedagem'} <IcExt />
                    </a>
                  ) : (
                    <span className="name static">{l.name || (preview ? AC : 'Hospedagem')}</span>
                  )}
                  <div className="meta">
                    {(l.check_in || l.check_out) && (
                      <span className="pill">{fmtDayMonth(l.check_in)} → {fmtDayMonth(l.check_out)}{ln ? ` · ${ln} noites` : ''}</span>
                    )}
                    {l.room_category && <span className="pill gold">{l.room_category}</span>}
                    {l.board && <span className="pill">{l.board}</span>}
                  </div>
                  {hasHtml(l.description_html) && <Rich html={l.description_html} />}
                  {(l.photos || []).length > 0 && (
                    <div className="gallery">
                      {(l.photos || []).slice(0, 5).map((src, k) => (
                        <button type="button" className="g" key={k} aria-label="Ampliar foto"
                          onClick={() => setLightbox({ photos: (l.photos || []), index: k })}>
                          {k === 0 && <span className="ph"><IcImg /></span>}
                          <LazyImg src={src} alt={l.name || ''} />
                          {k === 4 && (l.photos || []).length > 5 && (
                            <span className="g-more">+{(l.photos || []).length - 5}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── AÉREO ───── */}
        {flights.length > 0 && (
          <Block num={num()} title="Aéreo"
            sub={flights.some(f => f.leg_type === 'inbound') ? 'Ida e volta' : 'Trechos da viagem'}>
            {flights.map((f, i) => {
              const bags = (f.baggage || []).filter(k => BAGGAGE_ICONS[k])
              return (
                <div className="flight-wrap" key={f.id || i}>
                  <div className="flight">
                    <div className="tag">{LEG_LABELS[f.leg_type || ''] || 'Trecho'}</div>
                    <div className="route">
                      <div className="ap"><div className="code">{f.from_code || '—'}</div><div className="city">{f.from_city || ''}</div></div>
                      <div className="path"><IcPlane /></div>
                      <div className="ap"><div className="code">{f.to_code || '—'}</div><div className="city">{f.to_city || ''}</div></div>
                    </div>
                    <div className="det">
                      {f.airline && <b>{f.airline}</b>}
                      {[fmtDayMonth(f.date), f.stopover_label].filter(Boolean).join(' · ')}
                      {f.duration_label && <><br />{f.duration_label}</>}
                    </div>
                  </div>
                  {(bags.length > 0 || f.cabin_class) && (
                    <div className="flight-extra">
                      {f.cabin_class && <span className="pill gold">{CABIN_LABELS[f.cabin_class] || f.cabin_class}</span>}
                      {bags.map(k => {
                        const Ic = BAGGAGE_ICONS[k]
                        const opt = BAGGAGE_OPTIONS.find(o => o.key === k)
                        return <span key={k} className="bag"><Ic />{opt?.label}</span>
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </Block>
        )}

        {/* ───── MAPA ───── */}
        {pins.length > 0 && (
          <Block num={num()} title="Mapa da viagem" sub="Hospedagem e pontos marcados" onFirstOpen={initMap}>
            <div ref={mapRef} className="alq-map" />
            <div className="map-legend">
              {pinTypes.includes('lodging') && <span><i className="dot" style={{ background: PIN_COLORS.lodging }} /> Hospedagem</span>}
              {(pinTypes.includes('attraction') || pinTypes.includes('custom')) && <span><i className="dot" style={{ background: PIN_COLORS.attraction }} /> Atrações</span>}
              {pinTypes.includes('airport') && <span><i className="dot" style={{ background: PIN_COLORS.airport }} /> Aeroporto</span>}
            </div>
          </Block>
        )}

        {/* ───── ITINERÁRIO ───── */}
        {hasHtml(data.itinerary_html) ? (
          <Block num={num()} title="Itinerário" sub="Roteiro da viagem">
            <Rich html={data.itinerary_html} className="rich-body" />
          </Block>
        ) : days.length > 0 ? (
          <Block num={num()} title="Itinerário" sub="Dia a dia sugerido">
            <div className="timeline">
              {days.map((day, i) => (
                <div className="day" key={day.id || i}>
                  <div className="dh">
                    <span>{[day.day_label, fmtDayMonth(day.date)].filter(Boolean).join(' · ')}</span>
                    {day.title}
                  </div>
                  {(day.items || []).length > 0 && (
                    <ul>{(day.items || []).map((it, k) => <li key={k}>{it}</li>)}</ul>
                  )}
                </div>
              ))}
            </div>
          </Block>
        ) : null}

        {/* ───── IMPORTANTE ───── */}
        {hasHtml(data.important_html) && (
          <Block num={num()} title="Importante" sub="Antes de fechar, leia com atenção">
            <Rich html={data.important_html} className="important" />
          </Block>
        )}

        {/* ───── O QUE INCLUI ───── */}
        {(included.length > 0 || notIncluded.length > 0) && (
          <Block num={num()} title="O que inclui" sub="Tudo que está — e o que não está — no pacote">
            <div className="incl">
              {included.length > 0 && (
                <div className="col-ok">
                  <h4>Incluso</h4>
                  <ul className="yes">{included.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              )}
              {notIncluded.length > 0 && (
                <div>
                  <h4 style={{ color: 'var(--no)' }}>Não incluso</h4>
                  <ul className="nope">{notIncluded.map((it, i) => <li key={i}>{it}</li>)}</ul>
                </div>
              )}
            </div>
          </Block>
        )}

        {/* ───── POLÍTICAS DE CANCELAMENTO ───── */}
        {hasHtml(data.cancellation_html) && (
          <Block num={num()} title="Políticas de cancelamento" sub="Condições de alteração, cancelamento e reembolso">
            <Rich html={data.cancellation_html} className="important" />
          </Block>
        )}

        {/* ───── INVESTIMENTO ───── */}
        <section className="invest reveal">
          <div className="eyebrow">Investimento</div>
          <h3>Valores do pacote</h3>
          <div className="price-grid">
            <div className="price-card">
              <div className="lbl">Por pessoa</div>
              <div className="amt">{brl(data.price_per_person_cents) || (preview ? AC : '—')}</div>
              {data.occupancy_label && <div className="note">em {data.occupancy_label}</div>}
            </div>
            <div className="price-card total">
              <div className="lbl">Total{paxTotal > 0 ? ` · ${paxTotal} ${paxTotal > 1 ? 'pessoas' : 'pessoa'}` : ''}</div>
              <div className="amt">{brl(data.total_cents) || (preview ? AC : '—')}</div>
              <div className="note">pacote completo</div>
            </div>
          </div>
          {paymentConditions.length > 0 && (
            <div className="pay">
              {paymentConditions.map((p, i) => (
                <div className="row" key={i}><span>{p.label}</span><b>{p.value}</b></div>
              ))}
            </div>
          )}
          <div className="disclaimer">
            {data.price_disclaimer || 'Preços sujeitos a alteração sem aviso prévio e à disponibilidade no momento da reserva.'}<br />
            {data.quoted_at && <>Cotação realizada em {fmtBr(data.quoted_at)} · câmbio e tarifas aéreas podem variar até a emissão.</>}
          </div>
        </section>

        {/* ───── FECHAMENTO + CTA ───── */}
        <section className="closing reveal">
          {hasHtml(data.closing_html)
            ? <Rich html={data.closing_html} className="closing-rich" />
            : <>
              <h3>Vamos garantir essa viagem?</h3>
              <p>É só dar o sinal verde que travamos a tarifa e reservamos tudo. Qualquer dúvida, chama no WhatsApp.</p>
            </>}
          {waNumber && (
            <div className="cta-row">
              <a className="btn btn-primary" target="_blank" rel="noopener noreferrer"
                onClick={() => trackCta('reservar')}
                href={waHref(`Oi! Quero reservar o pacote "${data.title || 'da proposta'}" ✈️`)}>
                <IcWa /> Reservar agora
              </a>
              <a className="btn btn-ghost" target="_blank" rel="noopener noreferrer"
                onClick={() => trackCta('duvidas')}
                href={waHref(`Oi! Tenho algumas dúvidas sobre a proposta "${data.title || 'de viagem'}"`)}>
                <IcChat /> Tirar dúvidas
              </a>
            </div>
          )}
        </section>
      </main>

      {/* ───── RODAPÉ ───── */}
      <footer>
        <div className="foot">
          {(org.instagram_url || org.site_url) && (
            <div className="social">
              {org.instagram_url && <>Confira também nosso Instagram
                <a href={igHref(org.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IcIg /></a></>}
              {org.site_url && (
                <a href={urlHref(org.site_url)} target="_blank" rel="noopener noreferrer" aria-label="Site"><IcGlobe className="" /></a>
              )}
            </div>
          )}
          <div className="foot-sep" />
          {org.brand_logo_url
            ? <LazyImg src={org.brand_logo_url} alt={org.legal_name || ''} className="foot-logo-img" />
            : <div className="logo">{org.legal_name}</div>}
          <div className="legal">
            {(org.terms_url || org.privacy_url) && (
              <>
                {org.terms_url && <a href={org.terms_url} target="_blank" rel="noopener noreferrer">Termos de serviço</a>}
                {org.terms_url && org.privacy_url && ' · '}
                {org.privacy_url && <a href={org.privacy_url} target="_blank" rel="noopener noreferrer">Política de privacidade</a>}
                <br />
              </>
            )}
            {org.city_state && <>Estamos em {org.city_state}</>}
            {org.city_state && org.cnpj && ' · '}
            {org.cnpj && <>CNPJ {org.cnpj}</>}
            {org.cadastur && <> · CADASTUR {org.cadastur}</>}
          </div>
          <div className="rights">© {new Date().getFullYear()} {org.legal_name} · Todos os direitos reservados.</div>
        </div>
      </footer>

      {/* ───── MODAL HOTEL ───── */}
      {modalLodge && (() => {
        const ta = modalLodge.tripadvisor_data!
        const rating = ta.rating || 0
        const filled = Math.round(rating)
        return (
          <div className="modal show" role="dialog" aria-modal="true">
            <div className="modal-bg" onClick={closeHotel} />
            <div className="modal-card">
              <div className="modal-hero">
                <button className="modal-close" onClick={closeHotel} aria-label="Fechar">×</button>
                <LazyImg src={ta.photos?.[0] || modalLodge.photos?.[0]} alt={modalLodge.name || ''} />
              </div>
              <div className="modal-in">
                <h3 style={{ fontSize: 24, color: 'var(--navy)' }}>{modalLodge.name}</h3>
                {ta.address && <div style={{ color: 'var(--muted)', fontSize: 13.5, margin: '4px 0 14px' }}>{ta.address}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {rating > 0 && <span className="rating">{rating.toFixed(1)} <span style={{ fontWeight: 400, fontSize: 12 }}>/5</span></span>}
                  {rating > 0 && <span className="stars">{'●'.repeat(filled)}{'○'.repeat(Math.max(0, 5 - filled))}</span>}
                  {ta.reviews_count ? <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{ta.reviews_count.toLocaleString('pt-BR')} avaliações</span> : null}
                </div>
                {(ta.photos || []).length > 1 && (
                  <div className="mini-gal">
                    {(ta.photos || []).slice(1, 5).map((src, i) => <div key={i}><LazyImg src={src} alt="" /></div>)}
                  </div>
                )}
                <div ref={miniMapRef} className="mini-map" />
                <div className="ta-src">
                  Fotos, nota e informações extraídas do TripAdvisor
                  {ta.url && <> · <a href={ta.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--sea)' }}>ver perfil completo →</a></>}
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ───── Lightbox das fotos ───── */}
      {lightbox && (
        <Lightbox photos={lightbox.photos} index={lightbox.index}
          onIndex={i => setLightbox(lb => lb && { ...lb, index: i })}
          onClose={() => setLightbox(null)} />
      )}

      {/* ───── Botão flutuante de WhatsApp ───── */}
      {waNumber && (
        <a className="wa-fab no-print" target="_blank" rel="noopener noreferrer"
          onClick={() => trackCta('duvidas')}
          href={waHref(`Oi! Vim pela proposta "${data.title || 'de viagem'}" e gostaria de falar com vocês.`)}
          aria-label="Falar no WhatsApp">
          <IcWa />
          <span className="wa-fab-lbl">Falar no WhatsApp</span>
        </a>
      )}
    </div>
  )
}

function urlHref(u: string) { return /^https?:\/\//.test(u) ? u : `https://${u}` }
function igHref(u: string) {
  const handle = u.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  return /^https?:\/\//.test(u) ? u : `https://instagram.com/${handle}`
}

/* ═══════════════════════ CSS (portado do anexo) ═══════════════════════ */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,500;0,600;1,400&family=Inter:wght@400;500;600;700&display=swap');

.alq{
  --navy:#0B1B2B; --navy-soft:#13293f; --gold:#B8924B; --gold-soft:#cda968;
  --ivory:#F7F4EE; --paper:#FFFFFF; --ink:#1c2530; --muted:#6b7684;
  --line:#e7e1d6; --sea:#0e5d63; --ok:#2f7d5b; --no:#b45348;
  --shadow:0 1px 2px rgba(11,27,43,.04),0 8px 30px rgba(11,27,43,.06);
  --radius:16px;
  background:var(--ivory); color:var(--ink);
  font-family:'Inter',system-ui,sans-serif; line-height:1.6;
  -webkit-font-smoothing:antialiased; min-height:100vh;
}
.alq *{box-sizing:border-box}
.alq .wrap{max-width:860px;margin:0 auto;padding:0 20px}
.alq h1,.alq h2,.alq h3{font-family:'Lora',serif;font-weight:500;letter-spacing:-.01em;margin:0}
.alq .eyebrow{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:600}
@media(prefers-reduced-motion:no-preference){
  .alq .reveal{opacity:0;transform:translateY(14px);transition:opacity .7s ease,transform .7s ease}
  .alq .reveal.in{opacity:1;transform:none}
}

/* HERO */
.alq .hero{position:relative;min-height:78vh;display:flex;align-items:flex-end;
  background:linear-gradient(160deg,#0B1B2B 0%,#0e5d63 55%,#1c6f6a 100%);overflow:hidden}
.alq .hero>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity 1.1s ease}
.alq .hero>img.loaded{opacity:1}
.alq .hero::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(11,27,43,.15) 0%,rgba(11,27,43,.05) 40%,rgba(11,27,43,.82) 100%)}
.alq .hero-inner{position:relative;z-index:2;color:#fff;padding:0 20px 56px;max-width:860px;margin:0 auto;width:100%}
/* Etiqueta com fundo escuro translúcido: o nome do cliente precisa de
   contraste garantido sobre qualquer foto de capa */
.alq .hero .eyebrow{display:inline-block;color:var(--gold-soft);
  background:rgba(11,27,43,.55);backdrop-filter:blur(8px);
  border:1px solid rgba(205,169,104,.35);border-radius:999px;
  padding:7px 16px;text-shadow:none}
.alq .hero h1{color:#fff;font-size:clamp(34px,6vw,58px);line-height:1.05;margin:14px 0 10px;max-width:15ch;
  text-shadow:0 2px 30px rgba(0,0,0,.25)}
.alq .hero h2{color:rgba(255,255,255,.86);font-style:italic;font-size:clamp(17px,2.6vw,22px);font-weight:400}
.alq .hero-meta{margin-top:14px;font-size:13px;letter-spacing:.06em;color:rgba(255,255,255,.75)}

.alq .countdown{position:absolute;z-index:3;top:20px;right:20px;
  background:rgba(255,255,255,.10);backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.22);border-radius:14px;
  padding:14px 18px;text-align:center;color:#fff;min-width:132px}
.alq .countdown .cd-num{font-family:'Lora',serif;font-size:38px;line-height:1;color:var(--gold-soft)}
.alq .countdown .cd-lbl{font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.85;margin-top:4px}
.alq .countdown .cd-date{font-size:11px;opacity:.7;margin-top:6px}
@media(max-width:560px){.alq .countdown{top:14px;right:14px;padding:10px 14px;min-width:104px}.alq .countdown .cd-num{font-size:28px}}

/* 3 CARDS */
.alq .facts{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:-40px auto 0;position:relative;z-index:4}
.alq .fact{background:var(--paper);border-radius:var(--radius);padding:22px 20px;box-shadow:var(--shadow);
  border-top:3px solid var(--gold)}
.alq .fact .ic{width:26px;height:26px;color:var(--sea);margin-bottom:10px}
.alq .fact .k{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);font-weight:700}
/* valor em navy quase-preto: máximo contraste contra a etiqueta dourada */
.alq .fact .v{font-family:'Lora',serif;font-size:20px;margin-top:4px;line-height:1.2;color:var(--navy);font-weight:600}
.alq .fact .v small{display:block;font-family:'Inter';font-size:12.5px;color:#4a5560;font-weight:500;margin-top:3px;letter-spacing:normal}
@media(max-width:640px){.alq .facts{grid-template-columns:1fr;gap:10px;margin-top:-28px}}

/* INTRO */
.alq .intro{background:var(--paper);border-radius:var(--radius);box-shadow:var(--shadow);
  padding:34px 34px 30px;margin-top:22px;border-left:4px solid var(--gold);position:relative}
.alq .intro p{margin:0 0 14px;font-size:16.5px;color:#2a343f}
.alq .intro p:last-of-type{margin-bottom:22px}
.alq .intro .sig{font-family:'Lora',serif;font-style:italic;color:var(--navy);font-size:15px}
.alq .intro .sig span{display:block;font-family:'Inter';font-style:normal;font-size:12.5px;color:var(--muted);margin-top:2px}
@media(max-width:560px){.alq .intro{padding:26px 22px}}

/* BLOCOS RETRÁTEIS */
.alq .block{background:var(--paper);border-radius:var(--radius);box-shadow:var(--shadow);
  margin-top:16px;overflow:hidden}
.alq .block-head{display:flex;align-items:center;gap:14px;width:100%;
  padding:22px 26px;background:none;border:0;cursor:pointer;text-align:left;color:var(--ink);
  font-family:inherit;font-size:inherit}
.alq .block-head:focus-visible{outline:2px solid var(--gold);outline-offset:-2px;border-radius:12px}
.alq .block-head .num{font-family:'Lora',serif;font-size:14px;color:var(--gold);width:26px;flex:none}
.alq .block-head .bt{flex:1}
.alq .block-head h3{font-size:20px}
.alq .block-head .sub{font-size:12.5px;color:var(--muted);margin-top:2px}
.alq .chev{width:20px;height:20px;color:var(--muted);transition:transform .35s ease;flex:none}
.alq .block.open .chev{transform:rotate(180deg)}
.alq .block-body{max-height:0;overflow:hidden;transition:max-height .45s ease}
.alq .block-inner{padding:0 26px 26px}
@media(max-width:560px){.alq .block-head{padding:18px 20px}.alq .block-inner{padding:0 20px 22px}}

/* Hospedagem */
.alq .lodge+.lodge{margin-top:26px;padding-top:26px;border-top:1px solid var(--line)}
.alq .lodge .name{display:inline-flex;align-items:center;gap:7px;font-family:'Lora',serif;font-size:22px;
  color:var(--navy);text-decoration:none;cursor:pointer}
.alq .lodge .name.static{cursor:default}
.alq .lodge .name:not(.static):hover{color:var(--sea)}
.alq .lodge .name .link-ic{width:15px;height:15px;color:var(--gold);opacity:.9}
.alq .lodge .meta{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 14px}
.alq .pill{font-size:12.5px;padding:5px 12px;border-radius:999px;background:#f3efe6;color:#5a5140;
  border:1px solid var(--line);font-weight:500}
.alq .pill.gold{background:rgba(184,146,75,.12);color:#8a6b2f;border-color:rgba(184,146,75,.3)}
.alq .lodge p{margin:0 0 14px;color:#39424d;font-size:15px}
.alq .gallery{display:grid;grid-template-columns:2fr 1fr 1fr;grid-template-rows:repeat(2,90px);gap:8px}
.alq .gallery .g{border-radius:12px;overflow:hidden;background:linear-gradient(135deg,#dfe6e3,#cdd8d6);position:relative;padding:0;border:0;cursor:zoom-in;display:block}
.alq .gallery .g:first-child{grid-row:1/3}
.alq .gallery .g img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .8s,transform .3s;position:relative;z-index:1}
.alq .gallery .g img.loaded{opacity:1}
.alq .gallery .g:hover img{transform:scale(1.04)}
.alq .gallery .g .ph{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#9fb0ac}
.alq .gallery .g .g-more{position:absolute;inset:0;z-index:2;display:flex;align-items:center;justify-content:center;background:rgba(11,27,43,.55);color:#fff;font-size:18px;font-weight:700}
@media(max-width:560px){.alq .gallery{grid-template-rows:repeat(2,70px)}}

/* Lightbox */
.alq .pp-lb{position:fixed;inset:0;z-index:1200;background:rgba(11,27,43,.92);display:flex;align-items:center;justify-content:center;padding:20px}
.alq .pp-lb-img{max-width:94vw;max-height:88vh;object-fit:contain;border-radius:8px;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.alq .pp-lb-close{position:absolute;top:16px;right:18px;width:42px;height:42px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;border:0;font-size:26px;line-height:1;cursor:pointer}
.alq .pp-lb-close:hover{background:rgba(255,255,255,.26)}
.alq .pp-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,.14);color:#fff;border:0;display:flex;align-items:center;justify-content:center;cursor:pointer}
.alq .pp-lb-nav:hover{background:rgba(255,255,255,.26)}
.alq .pp-lb-nav.left{left:14px}.alq .pp-lb-nav.right{right:14px}
.alq .pp-lb-count{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.85);font-size:13px}
@media(max-width:560px){.alq .pp-lb-nav{width:40px;height:40px}}

/* Aéreo */
.alq .flight{display:flex;align-items:center;gap:16px;padding:16px 0}
.alq .flight+.flight{border-top:1px solid var(--line)}
.alq .flight .tag{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:600;width:64px;flex:none}
/* Rota sempre numa linha só: origem → avião → destino. As colunas dividem o
   espaço (min-width:0) e o nome do aeroporto quebra embaixo do código, sem
   empurrar o destino para a linha de baixo. */
.alq .route{display:flex;align-items:flex-start;gap:10px;flex:1;flex-wrap:nowrap;min-width:0}
.alq .route .ap{text-align:center;flex:1 1 0;min-width:0}
.alq .route .ap .code{font-family:'Lora',serif;font-size:22px;color:var(--navy);line-height:1}
.alq .route .ap .city{font-size:11px;color:var(--muted);line-height:1.25;margin-top:2px;word-break:break-word}
.alq .route .path{flex:1 1 44px;min-width:44px;margin-top:11px;height:1px;background:linear-gradient(90deg,var(--gold),transparent 40%,var(--gold) 60%,transparent);position:relative}
.alq .route .path svg{position:absolute;top:-9px;left:50%;transform:translateX(-50%);width:18px;height:18px;color:var(--sea)}
.alq .flight .det{text-align:right;font-size:12.5px;color:var(--muted);min-width:120px}
.alq .flight .det b{color:var(--ink);font-weight:600;display:block;font-size:13.5px}
.alq .flight-wrap+.flight-wrap{border-top:1px solid var(--line)}
.alq .flight-wrap .flight+.flight{border-top:0}
.alq .flight-extra{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;padding:0 0 14px 70px;margin-top:-4px}
.alq .flight-extra .bag{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:#5a5140}
.alq .flight-extra .bag svg{width:15px;height:15px;color:var(--gold)}
@media(max-width:560px){.alq .flight{flex-wrap:wrap}.alq .flight .det{text-align:left;width:100%}.alq .flight-extra{padding-left:0}}

/* Mapa */
.alq .alq-map{height:360px;border-radius:12px;z-index:0;border:1px solid var(--line);background:#eef0ec}
.alq .map-legend{display:flex;flex-wrap:wrap;gap:16px;margin-top:12px;font-size:12.5px;color:var(--muted)}
.alq .map-legend span{display:inline-flex;align-items:center;gap:6px}
.alq .dot{width:11px;height:11px;border-radius:50%;flex:none;display:inline-block}

/* Itinerário em HTML rico (respeita fontes/cores/imagens do editor) */
.alq .rich-body{font-size:15px;line-height:1.7;color:#39424d}
.alq .rich-body h1{font-family:'Lora',serif;font-size:24px;color:var(--navy);margin:6px 0 10px}
.alq .rich-body h2{font-family:'Lora',serif;font-size:20px;color:var(--navy);margin:6px 0 8px}
.alq .rich-body h3{font-family:'Lora',serif;font-size:17px;color:var(--navy);margin:6px 0 6px}
.alq .rich-body p{margin:0 0 12px}
.alq .rich-body img{max-width:100%;height:auto;border-radius:12px;margin:10px 0}
.alq .rich-body ul,.alq .rich-body ol{margin:0 0 12px;padding-left:22px}
.alq .rich-body li{margin:4px 0}
.alq .rich-body a{color:var(--sea);text-decoration:underline}
.alq .rich-body hr{border:0;border-top:1px solid var(--line);margin:16px 0}

/* Itinerário */
.alq .timeline{position:relative;padding-left:26px}
.alq .timeline::before{content:"";position:absolute;left:6px;top:6px;bottom:6px;width:2px;background:var(--line)}
.alq .day{position:relative;padding-bottom:22px}
.alq .day:last-child{padding-bottom:0}
.alq .day::before{content:"";position:absolute;left:-26px;top:4px;width:14px;height:14px;border-radius:50%;
  background:var(--paper);border:3px solid var(--gold)}
.alq .day .dh{font-family:'Lora',serif;font-size:17px;color:var(--navy)}
.alq .day .dh span{font-family:'Inter';font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--gold);display:block;margin-bottom:2px}
.alq .day ul{margin:8px 0 0;padding-left:0;list-style:none}
.alq .day li{font-size:14.5px;color:#39424d;padding:3px 0}

/* Importante */
.alq .important p{margin:0 0 12px;font-size:15px;color:#39424d}
.alq .important ul{margin:0;padding-left:20px}
.alq .important li{font-size:15px;color:#39424d;margin-bottom:7px}

/* Inclui */
.alq .incl{display:grid;grid-template-columns:1fr 1fr;gap:22px}
.alq .incl h4{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 12px;display:flex;align-items:center;gap:8px;font-family:'Inter'}
.alq .incl .col-ok h4{color:var(--ok)}
.alq .incl ul{list-style:none;margin:0;padding:0}
.alq .incl li{font-size:14.5px;padding:6px 0 6px 26px;position:relative;color:#39424d;border-bottom:1px solid var(--line)}
.alq .incl li:last-child{border-bottom:0}
.alq .incl li::before{position:absolute;left:0;top:6px;font-weight:700}
.alq .yes li::before{content:"✓";color:var(--ok)}
.alq .nope li::before{content:"✕";color:var(--no)}
@media(max-width:560px){.alq .incl{grid-template-columns:1fr;gap:8px}}

/* Investimento */
.alq .invest{background:linear-gradient(160deg,var(--navy),var(--navy-soft));color:#fff;border-radius:var(--radius);
  padding:38px 34px;margin-top:22px;box-shadow:0 20px 50px rgba(11,27,43,.22)}
.alq .invest .eyebrow{color:var(--gold-soft)}
.alq .invest h3{color:#fff;font-size:24px;margin:8px 0 24px}
.alq .price-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:26px}
.alq .price-card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:20px}
.alq .price-card.total{border-color:rgba(184,146,75,.55);background:rgba(184,146,75,.10)}
.alq .price-card .lbl{font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.66)}
.alq .price-card .amt{font-family:'Lora',serif;font-size:34px;margin-top:6px;line-height:1}
.alq .price-card.total .amt{color:var(--gold-soft)}
.alq .price-card .note{font-size:12px;color:rgba(255,255,255,.6);margin-top:6px}
.alq .pay{border-top:1px solid rgba(255,255,255,.14);padding-top:20px}
.alq .pay .row{display:flex;justify-content:space-between;padding:7px 0;font-size:14.5px;color:rgba(255,255,255,.9);gap:14px}
.alq .pay .row b{color:var(--gold-soft);font-weight:600;text-align:right}
.alq .disclaimer{margin-top:20px;font-size:11.5px;color:rgba(255,255,255,.5);line-height:1.5}
@media(max-width:560px){.alq .invest{padding:28px 22px}.alq .price-grid{grid-template-columns:1fr}}

/* Fechamento + CTA */
.alq .closing{text-align:center;padding:48px 20px 8px;max-width:640px;margin:0 auto}
.alq .closing h3{font-size:26px;color:var(--navy);margin-bottom:14px}
.alq .closing p{font-size:16.5px;color:#39424d;margin:0 auto 26px;max-width:56ch}
.alq .closing-rich h1,.alq .closing-rich h2,.alq .closing-rich h3{font-size:26px;color:var(--navy);margin-bottom:14px}
.alq .closing-rich p{font-size:16.5px;color:#39424d;margin:0 auto 26px;max-width:56ch}
.alq .cta-row{display:flex;gap:14px;justify-content:center;flex-wrap:wrap}
.alq .btn{display:inline-flex;align-items:center;gap:9px;padding:15px 26px;border-radius:999px;font-weight:600;
  font-size:15px;text-decoration:none;transition:transform .18s ease,box-shadow .18s ease;cursor:pointer;border:0}
.alq .btn:hover{transform:translateY(-2px)}
.alq .btn:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
.alq .btn svg{width:19px;height:19px}
.alq .btn-primary{background:#25D366;color:#0a3d22;box-shadow:0 8px 24px rgba(37,211,102,.32)}
.alq .btn-ghost{background:transparent;color:var(--navy);border:1.5px solid var(--navy)}
.alq .btn-ghost:hover{background:var(--navy);color:#fff}

/* Rodapé */
.alq footer{background:var(--navy);color:rgba(255,255,255,.72);margin-top:56px;padding:44px 20px 34px}
.alq .foot{max-width:860px;margin:0 auto;text-align:center}
.alq .foot .social{font-size:14px;margin-bottom:24px;display:flex;align-items:center;justify-content:center;gap:12px;flex-wrap:wrap}
.alq .foot .social a{color:#fff;display:inline-flex;transition:color .2s}
.alq .foot .social a:hover{color:var(--gold-soft)}
.alq .foot .social svg{width:22px;height:22px}
.alq .foot-sep{height:1px;background:rgba(255,255,255,.12);margin:24px 0}
.alq .foot .logo{font-family:'Lora',serif;font-size:22px;color:#fff;letter-spacing:.02em}
.alq .foot-logo-img{max-height:44px;width:auto;margin:0 auto;display:block;opacity:0;transition:opacity .6s}
.alq .foot-logo-img.loaded{opacity:1}
.alq .foot .legal{font-size:12.5px;margin-top:12px;line-height:1.8}
.alq .foot .legal a{color:rgba(255,255,255,.8);text-decoration:underline;text-underline-offset:3px}
.alq .foot .rights{font-size:11.5px;color:rgba(255,255,255,.45);margin-top:18px}

/* Modal hotel */
.alq .modal{position:fixed;inset:0;z-index:1000;display:none;align-items:center;justify-content:center;padding:20px}
.alq .modal.show{display:flex}
.alq .modal-bg{position:absolute;inset:0;background:rgba(11,27,43,.62);backdrop-filter:blur(3px)}
.alq .modal-card{position:relative;background:var(--paper);border-radius:18px;max-width:640px;width:100%;
  max-height:88vh;overflow:auto;box-shadow:0 30px 80px rgba(0,0,0,.4)}
.alq .modal-hero{height:190px;background:linear-gradient(135deg,#0e5d63,#1c6f6a);position:relative}
.alq .modal-hero img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.alq .modal-hero img.loaded{opacity:1}
.alq .modal-close{position:absolute;top:14px;right:14px;z-index:2;width:34px;height:34px;border-radius:50%;
  background:rgba(0,0,0,.4);color:#fff;border:0;cursor:pointer;font-size:18px}
.alq .modal-in{padding:24px 26px 28px}
.alq .modal-in .rating{display:inline-flex;align-items:center;gap:8px;background:#34a853;color:#fff;
  padding:4px 10px;border-radius:8px;font-weight:700;font-size:14px}
.alq .modal-in .stars{color:#f5a623;font-size:14px;letter-spacing:2px}
.alq .ta-src{font-size:11px;color:var(--muted);margin-top:14px}
.alq .mini-gal{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:16px 0}
.alq .mini-gal div{aspect-ratio:1;border-radius:8px;background:linear-gradient(135deg,#dfe6e3,#cdd8d6);overflow:hidden}
.alq .mini-gal img{width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .6s}
.alq .mini-gal img.loaded{opacity:1}
.alq .mini-map{height:170px;border-radius:12px;margin-top:14px;border:1px solid var(--line);background:#eef0ec}

/* Expirada */
.alq .expired-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}
.alq .expired-card{background:var(--paper);border-radius:var(--radius);box-shadow:var(--shadow);
  padding:44px 38px;max-width:520px;text-align:center}
.alq .expired-card h1{font-size:28px;color:var(--navy);margin:12px 0 12px}
.alq .expired-card p{color:#39424d;margin:0 0 24px}

/* ─────── Mobile: letras menores, espaços mais justos ─────── */
@media(max-width:560px){
  .alq{line-height:1.5}
  .alq .wrap{padding:0 14px}
  /* hero mais baixo e títulos compactos */
  .alq .hero{min-height:62vh}
  .alq .hero-inner{padding:0 14px 32px}
  .alq .hero h1{font-size:clamp(26px,7.5vw,34px);margin:10px 0 8px}
  .alq .hero h2{font-size:15px}
  .alq .hero .eyebrow{font-size:10.5px;letter-spacing:.14em;padding:5px 12px}
  .alq .hero-meta{margin-top:9px;font-size:12px}
  /* cards compactos: ícone à esquerda, texto à direita */
  .alq .facts{margin-top:-22px}
  .alq .fact{padding:13px 14px;display:grid;grid-template-columns:auto 1fr;column-gap:12px;align-items:center;border-top-width:2px}
  .alq .fact .ic{width:20px;height:20px;margin-bottom:0;grid-row:span 2}
  .alq .fact .k{font-size:10px;letter-spacing:.12em}
  .alq .fact .v{font-size:16px;margin-top:1px}
  .alq .fact .v small{font-size:11.5px;margin-top:1px}
  /* intro */
  .alq .intro{padding:20px 16px;margin-top:16px}
  .alq .intro p{font-size:14.5px;margin:0 0 10px}
  .alq .intro .sig{font-size:13.5px}
  /* blocos */
  .alq .block{margin-top:12px}
  .alq .block-head{padding:15px 16px;gap:10px}
  .alq .block-head .num{width:20px;font-size:12.5px}
  .alq .block-head h3{font-size:16.5px}
  .alq .block-head .sub{font-size:11.5px}
  .alq .block-inner{padding:0 16px 18px}
  /* hospedagem */
  .alq .lodge .name{font-size:18px}
  .alq .lodge p{font-size:14px}
  .alq .pill{font-size:11.5px;padding:4px 10px}
  .alq .lodge+.lodge{margin-top:20px;padding-top:20px}
  /* aéreo */
  .alq .route .ap .code{font-size:19px}
  .alq .flight .det{font-size:12px}
  .alq .flight .det b{font-size:13px}
  /* itinerário / importante / inclui */
  .alq .day .dh{font-size:15.5px}
  .alq .day li{font-size:13.5px}
  .alq .important p,.alq .important li{font-size:14px}
  .alq .incl li{font-size:13.5px;padding-left:24px}
  /* investimento */
  .alq .invest h3{font-size:20px;margin-bottom:18px}
  .alq .price-card{padding:16px}
  .alq .price-card .amt{font-size:28px}
  .alq .pay .row{font-size:13.5px}
  /* fechamento */
  .alq .closing{padding:36px 16px 4px}
  .alq .closing h3,.alq .closing-rich h1,.alq .closing-rich h2,.alq .closing-rich h3{font-size:21px}
  .alq .closing p,.alq .closing-rich p{font-size:14.5px}
  .alq .btn{padding:13px 22px;font-size:14px}
}

/* Botão flutuante de WhatsApp */
.alq .wa-fab{position:fixed;z-index:900;right:20px;bottom:20px;display:inline-flex;align-items:center;gap:10px;
  height:56px;padding:0 20px 0 16px;border-radius:999px;background:#25D366;color:#0a3d22;text-decoration:none;
  font-weight:700;font-size:15px;box-shadow:0 10px 28px rgba(37,211,102,.42);
  transition:transform .18s ease,box-shadow .18s ease}
.alq .wa-fab:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(37,211,102,.5)}
.alq .wa-fab svg{width:26px;height:26px;flex:none}
.alq .wa-fab-lbl{white-space:nowrap}
@media(max-width:560px){
  .alq .wa-fab{right:16px;bottom:16px;height:52px;padding:0 16px 0 14px;font-size:14px}
  .alq .wa-fab svg{width:24px;height:24px}
}

/* Print */
@media print{
  .alq .block-body{max-height:none!important;overflow:visible!important}
  .alq .countdown,.alq .cta-row{display:none!important}
  .alq .hero{min-height:320px}
  .alq,.alq *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`
