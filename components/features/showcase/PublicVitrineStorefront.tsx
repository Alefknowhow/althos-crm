'use client'

/**
 * Vitrine pública estilo Booking/Decolar: header white-label + grade de
 * ofertas. Cada card abre a oferta como uma cotação pública (/p/[token]).
 */

import { useMemo, useState } from 'react'
import { MapPin, CalendarDays, Users, Search, MessageCircle, Globe } from 'lucide-react'

const IgIcon = () => (
  <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
  </svg>
)

type Offer = {
  public_token: string
  title: string | null
  category: string | null
  cover_image_url: string | null
  destinations: { name?: string }[] | null
  start_date: string | null
  end_date: string | null
  price_per_person_cents: number | null
  total_cents: number | null
  pax_count: number | null
}

export type VitrineData = {
  org: {
    legal_name?: string | null
    brand_logo_url?: string | null
    brand_accent?: string | null
    instagram_url?: string | null
    site_url?: string | null
    whatsapp_number?: string | null
    city_state?: string | null
  }
  offers: Offer[]
}

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
function fmt(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00')
  return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
function brl(cents?: number | null): string {
  if (!cents) return ''
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
}
function destName(o: Offer): string {
  return (o.destinations || []).map(d => d?.name).filter(Boolean).join(' · ')
}
function waHref(num?: string | null, title?: string | null): string {
  const digits = (num || '').replace(/\D/g, '')
  if (!digits) return ''
  const wa = digits.length <= 11 ? `55${digits}` : digits
  return `https://wa.me/${wa}?text=${encodeURIComponent(`Olá! Vi o pacote "${title || 'de viagem'}" na vitrine e quero saber mais.`)}`
}

export default function PublicVitrineStorefront({ data }: { data: VitrineData }) {
  const { org, offers } = data
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('all')

  const categories = useMemo(
    () => Array.from(new Set(offers.map(o => o.category).filter(Boolean))) as string[],
    [offers],
  )
  const filtered = offers.filter(o => {
    if (cat !== 'all' && o.category !== cat) return false
    if (!q.trim()) return true
    const hay = `${o.title || ''} ${destName(o)} ${o.category || ''}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const accent = org.brand_accent || '#0e5d63'

  return (
    <div className="vit">
      <style>{CSS}</style>

      {/* Header */}
      <header className="vit-header" style={{ ['--accent' as any]: accent }}>
        <div className="vit-header-in">
          <div className="vit-brand">
            {org.brand_logo_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={org.brand_logo_url} alt={org.legal_name || ''} />
              : <span className="vit-brand-name">{org.legal_name}</span>}
          </div>
          <div className="vit-header-links">
            {org.instagram_url && <a href={igHref(org.instagram_url)} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><IgIcon /></a>}
            {org.site_url && <a href={siteHref(org.site_url)} target="_blank" rel="noopener noreferrer" aria-label="Site"><Globe className="w-[18px] h-[18px]" /></a>}
          </div>
        </div>
        <div className="vit-hero">
          <h1>Nossos pacotes de viagem</h1>
          <p>Escolha o seu destino e fale com a gente — {org.legal_name}{org.city_state ? ` · ${org.city_state}` : ''}</p>
          <div className="vit-search">
            <Search className="w-4 h-4" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar destino ou pacote…" />
          </div>
          {categories.length > 0 && (
            <div className="vit-cats">
              <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Todos</button>
              {categories.map(c => (
                <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Grid */}
      <main className="vit-main">
        {filtered.length === 0 ? (
          <div className="vit-empty">Nenhum pacote encontrado{q || cat !== 'all' ? ' para esse filtro.' : ' no momento.'}</div>
        ) : (
          <div className="vit-grid">
            {filtered.map(o => {
              const price = o.price_per_person_cents
              return (
                <a key={o.public_token} className="vit-card" href={`/p/${o.public_token}`} target="_blank" rel="noopener noreferrer">
                  <div className="vit-card-img">
                    {o.cover_image_url
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={o.cover_image_url} alt={o.title || ''} loading="lazy" />
                      : <div className="vit-card-ph" />}
                    {o.category && <span className="vit-card-cat">{o.category}</span>}
                  </div>
                  <div className="vit-card-body">
                    <h3>{o.title || 'Pacote de viagem'}</h3>
                    {destName(o) && <p className="vit-card-dest"><MapPin className="w-3.5 h-3.5" /> {destName(o)}</p>}
                    <div className="vit-card-meta">
                      {(o.start_date || o.end_date) && <span><CalendarDays className="w-3.5 h-3.5" /> {fmt(o.start_date)}{o.end_date ? ` – ${fmt(o.end_date)}` : ''}</span>}
                      {o.pax_count ? <span><Users className="w-3.5 h-3.5" /> {o.pax_count} pax</span> : null}
                    </div>
                    <div className="vit-card-foot">
                      {price ? (
                        <div className="vit-price"><small>a partir de</small><b>{brl(price)}</b><small>por pessoa</small></div>
                      ) : o.total_cents ? (
                        <div className="vit-price"><b>{brl(o.total_cents)}</b><small>pacote</small></div>
                      ) : <span className="vit-price-sob">Sob consulta</span>}
                      <span className="vit-card-cta">Ver detalhes</span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </main>

      {/* WhatsApp flutuante */}
      {org.whatsapp_number && (
        <a className="vit-fab" href={waHref(org.whatsapp_number)} target="_blank" rel="noopener noreferrer" aria-label="Falar no WhatsApp">
          <MessageCircle className="w-6 h-6" />
        </a>
      )}

      <footer className="vit-footer">
        {org.legal_name} {org.city_state ? `· ${org.city_state}` : ''} · © {new Date().getFullYear()}
      </footer>
    </div>
  )
}

function siteHref(u: string) { return /^https?:\/\//.test(u) ? u : `https://${u}` }
function igHref(u: string) {
  const h = u.replace(/^@/, '').replace(/^https?:\/\/(www\.)?instagram\.com\//, '').replace(/\/$/, '')
  return /^https?:\/\//.test(u) ? u : `https://instagram.com/${h}`
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
.vit{min-height:100vh;background:#f5f6f8;color:#1c2530;font-family:'Inter',system-ui,sans-serif}
.vit *{box-sizing:border-box}
.vit-header{background:linear-gradient(160deg,#0B1B2B,var(--accent) 140%);color:#fff}
.vit-header-in{max-width:1120px;margin:0 auto;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:12px}
.vit-brand img{height:36px;width:auto;object-fit:contain}
.vit-brand-name{font-weight:800;font-size:18px}
.vit-header-links{display:flex;gap:14px}
.vit-header-links a{color:#fff;opacity:.85;transition:opacity .2s}
.vit-header-links a:hover{opacity:1}
.vit-hero{max-width:1120px;margin:0 auto;padding:8px 20px 34px}
.vit-hero h1{font-size:clamp(24px,4vw,36px);font-weight:800;letter-spacing:-.02em;margin:8px 0 6px}
.vit-hero p{color:rgba(255,255,255,.82);font-size:14.5px;margin:0 0 18px}
.vit-search{display:flex;align-items:center;gap:8px;background:#fff;border-radius:12px;padding:12px 14px;max-width:440px;color:#64748b;box-shadow:0 10px 30px -12px rgba(0,0,0,.4)}
.vit-search input{border:0;outline:0;flex:1;font-size:15px;color:#1c2530;background:transparent}
.vit-cats{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.vit-cats button{font-size:13px;font-weight:600;padding:6px 14px;border-radius:999px;border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;cursor:pointer;transition:background .2s}
.vit-cats button.on{background:#fff;color:#0B1B2B;border-color:#fff}
.vit-main{max-width:1120px;margin:0 auto;padding:26px 20px 60px}
.vit-empty{text-align:center;color:#64748b;padding:60px 20px}
.vit-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:20px}
.vit-card{display:flex;flex-direction:column;background:#fff;border-radius:16px;overflow:hidden;text-decoration:none;color:inherit;box-shadow:0 1px 2px rgba(11,27,43,.04),0 10px 30px -18px rgba(11,27,43,.25);transition:transform .18s ease,box-shadow .18s ease}
.vit-card:hover{transform:translateY(-3px);box-shadow:0 14px 40px -16px rgba(11,27,43,.35)}
.vit-card-img{position:relative;aspect-ratio:16/10;background:linear-gradient(135deg,#dfe6e3,#cdd8d6)}
.vit-card-img img{width:100%;height:100%;object-fit:cover}
.vit-card-ph{width:100%;height:100%}
.vit-card-cat{position:absolute;top:10px;left:10px;background:rgba(11,27,43,.72);color:#fff;font-size:11.5px;font-weight:600;padding:4px 10px;border-radius:999px;backdrop-filter:blur(4px)}
.vit-card-body{padding:14px 16px 16px;display:flex;flex-direction:column;gap:6px;flex:1}
.vit-card-body h3{font-size:16px;font-weight:700;letter-spacing:-.01em;line-height:1.25;margin:0}
.vit-card-dest{display:flex;align-items:center;gap:5px;font-size:13px;color:#5a6572;margin:0}
.vit-card-meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12.5px;color:#8a94a0;margin-top:2px}
.vit-card-meta span{display:inline-flex;align-items:center;gap:5px}
.vit-card-foot{display:flex;align-items:flex-end;justify-content:space-between;gap:10px;margin-top:auto;padding-top:12px}
.vit-price{display:flex;flex-direction:column;line-height:1.15}
.vit-price small{font-size:10.5px;color:#8a94a0}
.vit-price b{font-size:19px;font-weight:800;color:var(--accent,#0e5d63)}
.vit-price-sob{font-size:13px;color:#8a94a0;font-weight:600}
.vit-card-cta{background:#0B1B2B;color:#fff;font-size:12.5px;font-weight:600;padding:8px 14px;border-radius:10px;white-space:nowrap}
.vit-fab{position:fixed;right:20px;bottom:20px;z-index:50;display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#25D366;color:#fff;box-shadow:0 10px 28px rgba(37,211,102,.45);transition:transform .18s}
.vit-fab:hover{transform:translateY(-2px)}
.vit-footer{text-align:center;color:#8a94a0;font-size:12.5px;padding:24px 20px 40px}
@media(max-width:560px){.vit-grid{grid-template-columns:1fr}.vit-hero{padding-bottom:26px}}
`
