'use client'

/**
 * Formatting helpers, inline icons, and small self-contained UI pieces
 * (Rich text, image lazy-load, lightbox, collapsible Block, scroll-reveal
 * hook) for the public quotation view. Split out of PublicQuotationView.tsx.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { setOptions } from '@googlemaps/js-api-loader'

let mapsOptionsSet = false
export function ensureMapsOptions() {
  if (mapsOptionsSet) return
  setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '', language: 'pt-BR' })
  mapsOptionsSet = true
}

/** Pin em formato de gota (mesmo visual do marcador antigo), colorido por tipo. */
export function pinIconUrl(color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="27" height="36" viewBox="0 0 27 36">`
    + `<path d="M13.5 0C6.04 0 0 6.04 0 13.5c0 10.1 13.5 22.5 13.5 22.5s13.5-12.4 13.5-22.5C27 6.04 20.96 0 13.5 0z" fill="${color}" stroke="#fff" stroke-width="2"/>`
    + `<circle cx="13.5" cy="13.5" r="5" fill="#fff"/></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

/* ─────────────────────── tipos (contrato da RPC) ─────────────────────── */
/* ─────────────────────── helpers ─────────────────────── */
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export function d(iso?: string | null): Date | null {
  if (!iso) return null
  const dt = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso)
  return Number.isNaN(dt.getTime()) ? null : dt
}
export function fmtShort(iso?: string | null): string {
  const dt = d(iso)
  return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]} ${dt.getFullYear()}` : ''
}
export function fmtDayMonth(iso?: string | null): string {
  const dt = d(iso)
  return dt ? `${dt.getDate()} ${MONTHS[dt.getMonth()]}` : ''
}
export function fmtBr(iso?: string | null): string {
  const dt = d(iso)
  return dt ? dt.toLocaleDateString('pt-BR') : ''
}
export function brl(cents?: number | null): string {
  if (cents == null) return ''
  const v = cents / 100
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v % 1 === 0 ? 0 : 2 })
}
export function nightsBetween(a?: string | null, b?: string | null): number | null {
  const da = d(a); const db = d(b)
  if (!da || !db) return null
  return Math.max(0, Math.round((db.getTime() - da.getTime()) / 86400000))
}

export const PIN_COLORS: Record<string, string> = {
  lodging: '#0f62fe', attraction: '#222222', airport: '#3f3f3f', custom: '#222222',
}
export const LEG_LABELS: Record<string, string> = { outbound: 'Ida', inbound: 'Volta', connection: 'Conexão' }

export const BAGGAGE_OPTIONS = [
  { key: 'item_pessoal', label: 'Item pessoal (mochila)', short: 'Mochila' },
  { key: 'mao', label: 'Bagagem de mão (10 kg)', short: 'Mão 10kg' },
  { key: 'despachada', label: 'Bagagem despachada (23 kg)', short: 'Despacho 23kg' },
] as const
export const CABIN_LABELS: Record<string, string> = {
  economica: 'Econômica', premium: 'Premium Economy', executiva: 'Executiva', primeira: 'Primeira Classe',
}

/** HTML "vazio" do editor (ex.: <p></p>) não conta como conteúdo. */
export function hasHtml(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim() !== '' || /<img/i.test(html)
}

/** HTML rico do agente, sanitizado no cliente antes de renderizar. */
export function Rich({ html, className, onImageClick }: { html?: string | null; className?: string; onImageClick?: (src: string) => void }) {
  const [clean, setClean] = useState('')
  useEffect(() => {
    let on = true
    if (!html) { setClean(''); return }
    import('dompurify').then(m => { if (on) setClean(m.default.sanitize(html)) })
    return () => { on = false }
  }, [html])
  if (!clean) return null
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
      onClick={onImageClick ? (e) => {
        const target = e.target as HTMLElement
        if (target.tagName === 'IMG') onImageClick((target as HTMLImageElement).src)
      } : undefined}
      style={onImageClick ? { cursor: 'default' } : undefined}
    />
  )
}

/** Descrição de hospedagem no modal — fonte menor, corta em 4 linhas com
 *  "ver mais" quando o texto excede isso; "ver menos" recolhe de volta. */
export function ClampedDescription({ html }: { html?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [overflowing, setOverflowing] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || expanded) return
    setOverflowing(el.scrollHeight > el.clientHeight + 2)
  }, [html, expanded])

  if (!hasHtml(html)) return null

  return (
    <div className="lodge-desc">
      <div ref={ref} className={expanded ? 'lodge-desc-body' : 'lodge-desc-body clamped'}>
        <Rich html={html} />
      </div>
      {(overflowing || expanded) && (
        <button type="button" className="lodge-desc-toggle" onClick={() => setExpanded(v => !v)}>
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  )
}

/* ─────────────────────── ícones (inline, iguais ao anexo) ─────────────────────── */
export const IcPin = () => <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10Z" /><circle cx="12" cy="11" r="2.2" /></svg>
export const IcGlobe = ({ className = 'ic' }: { className?: string }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" /></svg>
export const IcCal = () => <svg className="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>
export const IcChev = () => <svg className="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
export const IcPlane = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M2.5 19h19v2h-19zM22 9.5c-.3-1-1.4-1.6-2.4-1.3l-4.7 1.3-6-5.6-1.8.5 3.6 6.2-4.4 1.2-1.7-1.4-1.4.4L5 15l14-3.8c1-.3 1.6-1.4 1.3-2.4z" /></svg>
export const IcExt = () => <svg className="link-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M9 7h8v8" /></svg>
export const IcWa = () => <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Zm5.3 14c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .1-1.7-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.5-4-.1-.2-1-1.4-1-2.6s.6-1.8.8-2.1c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.5l.7 1.8c.1.2.1.4 0 .5l-.3.5-.3.4c-.1.1-.2.3-.1.5s.5.9 1.1 1.4c.8.7 1.4.9 1.6 1s.3.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.7.8c.2.1.4.2.4.3.1.1.1.6-.1 1.1Z" /></svg>
export const IcChat = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>
export const IcIg = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
export const IcImg = () => <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>
export const IcBackpack = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5M8 10h8" /></svg>
export const IcShip = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 16.5 5 9h14l2 7.5M2 20c1.2 1 2.5 1 3.7 0 1.2 1 2.5 1 3.7 0 1.2 1 2.5 1 3.7 0 1.2 1 2.5 1 3.7 0 1.2 1 2.5 1 3.7 0" /><path d="M8 9V5h8v4M12 2v3" /></svg>
export const IcCarryon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="6" y="7" width="12" height="14" rx="2" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M10 11v6M14 11v6" /></svg>
export const IcSuitcase = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 10v6M16 10v6M12 10v6" /></svg>
export const BAGGAGE_ICONS: Record<string, () => JSX.Element> = {
  item_pessoal: IcBackpack, mao: IcCarryon, despachada: IcSuitcase,
}

/* ─────────────────────── imagem com fade + fallback ─────────────────────── */
export function LazyImg({ src, alt = '', className }: { src?: string | null; alt?: string; className?: string }) {
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
export function Lightbox({
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
export function Block({
  num, title, sub, defaultOpen = true, onFirstOpen, children,
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
    // NÃO chama sync() aqui: maxH já nasce 'none' (totalmente aberto) quando
    // defaultOpen — travar num valor em px medido antes das imagens carregarem
    // cortava o conteúdo depois que elas terminavam de carregar ("meia-fase").
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
export function useReveal(rootRef: React.RefObject<HTMLDivElement>) {
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

