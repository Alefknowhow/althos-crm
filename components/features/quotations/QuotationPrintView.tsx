'use client'

/**
 * Documento comercial (A4, 1 página) da cotação — gerado via window.print()
 * (sem headless-Chrome/puppeteer: o navegador do usuário é o motor de PDF).
 * Reaproveita 100% os dados já existentes em travel_proposals/
 * quotation_lodgings/quotation_flights (ver actions/quotations.ts,
 * getQuotationFull) — nenhum campo novo foi criado no banco. Seções sem
 * dado correspondente (transfer, seguro, "outros serviços") simplesmente
 * não têm de onde vir informação hoje e por isso nunca renderizam — ver
 * nota no relatório desta tarefa.
 *
 * Paleta deliberadamente restrita a branco/preto/cinza + vermelho só como
 * destaque (preço, seção "Atenção") — a cor de marca da org (org.
 * primary_color) NÃO é usada aqui; ela é a linguagem visual da proposta
 * pública (PublicQuotationView), este documento é o "papel timbrado"
 * comercial, mais sóbrio.
 */

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Check, X, Phone, Mail, Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { BAGGAGE_OPTIONS, CABIN_LABELS } from './PublicQuotationView'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
}

type Lodging = {
  name: string
  check_in: string | null
  check_out: string | null
  room_category: string | null
  board: string | null
  photos?: string[] | null
}

type Flight = {
  leg_type: string
  from_code: string | null
  from_city: string | null
  to_code: string | null
  to_city: string | null
  airline: string | null
  date: string | null
  duration_label: string | null
  stopover_label: string | null
  cabin_class: string | null
  baggage?: string[] | null
}

type Quotation = {
  id: string
  title: string | null
  client_name: string | null
  destinations: { name: string; country?: string | null }[] | null
  origin_label: string | null
  start_date: string | null
  end_date: string | null
  pax_adults: number | null
  pax_children: number | null
  occupancy_label: string | null
  price_per_person_cents: number | null
  total_cents: number | null
  payment_conditions: { label: string; value?: string | null }[] | null
  price_disclaimer: string | null
  included: string[] | null
  not_included: string[] | null
  cancellation_html: string | null
  flights_html: string | null
  cover_image_url?: string | null
  tours_html?: string | null
  validity_days?: number | null
  quoted_at?: string | null
  created_at?: string | null
}

function fmtDate(d?: string | null) {
  if (!d) return '—'
  // Campos "date" (start_date/check_in/...) vêm como YYYY-MM-DD puro;
  // já quoted_at/created_at são timestamps completos (com hora/timezone) —
  // normaliza pegando só a parte da data antes de ancorar em meio-dia,
  // senão "YYYY-MM-DDTHH:mm:ssZT12:00:00" vira Invalid Date.
  const datePart = d.slice(0, 10)
  return new Date(datePart + 'T12:00:00').toLocaleDateString('pt-BR')
}
function fmtCurrency(cents: number | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}
function stripHtml(html?: string | null) {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}
/** HTML "vazio" do editor (ex.: <p></p>) não conta como conteúdo — mesma
 *  regra usada em PublicQuotationView, pra decidir se uma seção aparece. */
function hasHtml(html?: string | null): boolean {
  if (!html) return false
  return html.replace(/<[^>]*>/g, '').trim() !== '' || /<img/i.test(html)
}

/** HTML rico sanitizado no cliente — mesmo padrão de PublicQuotationView,
 *  só que aqui em corpo de texto compacto (sem clique em imagem).
 *  `onReady` avisa o pai quando o conteúdo sanitizado (ou a ausência dele)
 *  já está no DOM — a medição de compactação (useAutoDensity) só pode
 *  rodar depois disso, senão mede a página ANTES do dompurify carregar
 *  (import assíncrono) e decide um nível de fonte que fica pequeno demais
 *  assim que o texto rico aparece. */
function Rich({ html, className, onReady }: { html?: string | null; className?: string; onReady?: () => void }) {
  const [clean, setClean] = useState('')
  useEffect(() => {
    let on = true
    if (!html) { setClean(''); onReady?.(); return }
    import('dompurify').then(m => { if (on) { setClean(m.default.sanitize(html)); onReady?.() } })
    return () => { on = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html])
  if (!clean) return null
  // eslint-disable-next-line react/no-danger
  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 mb-[0.5em]">
      <span className="w-[3px] h-[0.9em] bg-red-600 shrink-0" />
      <p className="font-bold text-[0.82em] uppercase tracking-wide">{children}</p>
    </div>
  )
}

/* ── Compactação progressiva ────────────────────────────────────────────
 * O documento precisa caber em UMA página A4 sem cortar conteúdo. Em vez
 * de truncar, reduzimos progressivamente escala de fonte e espaçamento
 * (3 níveis) até o conteúdo real caber na altura útil da página —
 * medido de verdade no DOM, não estimado. */
const DENSITY_FONT_PX = [11.5, 10.5, 9.5]
const DENSITY_GAP = ['mb-[1.1em]', 'mb-[0.85em]', 'mb-[0.65em]']
const DENSITY_HERO_W = ['w-full', 'w-[92%]', 'w-[78%]']
const A4_HEIGHT_MM = 297
const MM_TO_PX = 3.7795275591

/** `contentReady` deve só virar true depois que todo HTML rico assíncrono
 *  (ver Rich/onReady acima) já estiver no DOM — medir antes disso mede uma
 *  página artificialmente mais curta e escolhe uma densidade que fica
 *  pequena demais assim que o texto rico aparece. */
function useAutoDensity(ref: React.RefObject<HTMLDivElement>, resetKey: string, contentReady: boolean) {
  const [density, setDensity] = useState(0)
  // Evita reverificar o mesmo nível duas vezes (Strict Mode do React roda
  // effects 2x em dev) — sem isso, a escalada podia ficar presa num nível
  // intermediário mesmo com conteúdo ainda maior que uma página A4.
  const checkedRef = useRef(-1)

  useEffect(() => { setDensity(0); checkedRef.current = -1 }, [resetKey])

  useEffect(() => {
    if (!contentReady) return
    if (checkedRef.current === density) return
    checkedRef.current = density
    const el = ref.current
    if (!el) return
    // scrollHeight já reflete o layout pós-commit deste render — não
    // precisa esperar rAF/paint (e não pode depender disso: numa aba sem
    // compositing ativo, requestAnimationFrame nunca dispara).
    const maxPx = A4_HEIGHT_MM * MM_TO_PX
    if (el.scrollHeight > maxPx && density < DENSITY_FONT_PX.length - 1) {
      setDensity(density + 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [density, resetKey, contentReady])

  return density
}

export default function QuotationPrintView({
  quotation, lodgings, flights, org,
}: {
  quotation: Quotation
  lodgings: Lodging[]
  flights: Flight[]
  org: OrgBranding
}) {
  const pageRef = useRef<HTMLDivElement>(null)

  const destinations = (quotation.destinations || []).map(d => d.name).filter(Boolean).join(', ')
  const paxLine = `${quotation.pax_adults ?? 0} adulto${(quotation.pax_adults ?? 0) === 1 ? '' : 's'}${quotation.pax_children ? ` · ${quotation.pax_children} criança${quotation.pax_children === 1 ? '' : 's'}` : ''}`

  const idas = flights.filter(f => f.leg_type === 'outbound')
  const voltas = flights.filter(f => f.leg_type === 'inbound')
  const conexoes = flights.filter(f => f.leg_type === 'connection')
  const legGroups = [
    { label: 'Ida', legs: idas }, { label: 'Volta', legs: voltas }, { label: 'Conexão', legs: conexoes },
  ].filter(g => g.legs.length > 0)
  const flightsHtmlText = stripHtml(quotation.flights_html)

  const heroImage = quotation.cover_image_url || lodgings.find(l => l.photos?.[0])?.photos?.[0] || null

  const hasIncludedExcluded = (quotation.included?.length ?? 0) > 0 || (quotation.not_included?.length ?? 0) > 0
  const hasTours = hasHtml(quotation.tours_html)
  const cancellationHasContent = hasHtml(quotation.cancellation_html)
  const hasValidity = !!quotation.validity_days && quotation.validity_days > 0

  // Quantos blocos de HTML rico assíncrono (Rich/dompurify) existem nesta
  // renderização — a medição de compactação só roda depois que todos
  // reportarem onReady (ver useAutoDensity acima).
  const richBlockCount = (hasTours ? 1 : 0) + (cancellationHasContent ? 1 : 0)
  const [richReadyCount, setRichReadyCount] = useState(0)
  useEffect(() => { setRichReadyCount(0) }, [quotation.id])
  const contentReady = richReadyCount >= richBlockCount
  const onRichReady = () => setRichReadyCount(c => c + 1)

  const density = useAutoDensity(pageRef, quotation.id, contentReady)

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <a href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div
        ref={pageRef}
        data-density={density}
        style={{ fontSize: `${DENSITY_FONT_PX[density]}px` }}
        className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-[12mm] print:p-[12mm] text-black"
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 pb-[0.8em] border-b border-gray-300 break-inside-avoid">
          <div className="flex items-center gap-2.5 min-w-0">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-[2.6em] w-auto object-contain shrink-0" />
            )}
            <p className="text-[1.35em] font-bold leading-tight truncate">{org.name}</p>
          </div>
          <div className="text-right text-[0.68em] text-gray-500 space-y-[0.2em] shrink-0">
            {org.contact_phone && <p className="flex items-center justify-end gap-1"><Phone className="w-[0.9em] h-[0.9em]" /> {org.contact_phone}</p>}
            {org.contact_email && <p className="flex items-center justify-end gap-1"><Mail className="w-[0.9em] h-[0.9em]" /> {org.contact_email}</p>}
            {org.website && <p className="flex items-center justify-end gap-1"><Globe className="w-[0.9em] h-[0.9em]" /> {org.website}</p>}
          </div>
        </div>

        {/* ── Hero 16:9 ──────────────────────────────────────────── */}
        {heroImage && (
          <div className={`${DENSITY_HERO_W[density]} mx-auto mt-[0.9em] mb-[0.9em] aspect-[16/9] overflow-hidden rounded-md break-inside-avoid`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={destinations || quotation.title || 'Destino'} className="w-full h-full object-cover" />
          </div>
        )}

        {/* ── Resumo do cliente ──────────────────────────────────── */}
        <div className={`${DENSITY_GAP[density]} break-inside-avoid`}>
          <div className="flex items-center justify-between gap-3 mb-[0.5em]">
            <p className="font-bold text-[1.05em] uppercase tracking-wide">Orçamento personalizado</p>
            <p className="text-[0.68em] text-gray-400 shrink-0">Código #{quotation.id.slice(0, 8).toUpperCase()}</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-[1em] gap-y-[0.4em]">
            <SummaryField label="Cliente" value={quotation.client_name || quotation.title || '—'} />
            {destinations && <SummaryField label="Destino" value={destinations} />}
            {quotation.start_date && <SummaryField label="Período" value={`${fmtDate(quotation.start_date)} a ${fmtDate(quotation.end_date)}`} />}
            <SummaryField label="Passageiros" value={paxLine} />
          </div>
        </div>

        {/* ── Aviso de disponibilidade (compacto) ───────────────────── */}
        <div className="border border-gray-300 px-[0.8em] py-[0.5em] mb-[1em] break-inside-avoid">
          <p className="text-[0.68em] leading-snug">
            <span className="font-bold text-red-600">Atenção — </span>
            Esta é uma cotação. Os serviços estão sujeitos à disponibilidade e os valores podem sofrer alterações até a efetivação da reserva.
          </p>
        </div>

        {/* ── Produtos e serviços ────────────────────────────────── */}
        {lodgings.length > 0 && (
          <div className={DENSITY_GAP[density]}>
            <SectionLabel>Hospedagem</SectionLabel>
            {lodgings.map((l, i) => (
              <div key={i} className={cn('break-inside-avoid', i < lodgings.length - 1 && 'mb-[0.6em] pb-[0.6em] border-b border-gray-100')}>
                <p className="font-semibold text-[0.85em]">{l.name}</p>
                <p className="text-[0.75em] text-gray-600">
                  Check-in {fmtDate(l.check_in)} · Check-out {fmtDate(l.check_out)}
                  {(l.room_category || l.board) ? ` · ${[l.room_category, l.board].filter(Boolean).join(' · ')}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {legGroups.length > 0 && (
          <div className={DENSITY_GAP[density]}>
            <SectionLabel>Voos</SectionLabel>
            {legGroups.map(group => (
              <div key={group.label} className="mb-[0.5em] last:mb-0">
                {group.legs.map((f, i) => {
                  const bag = (f.baggage || []).map(k => BAGGAGE_OPTIONS.find(b => b.key === k)?.short).filter(Boolean).join(' · ')
                  const cabin = f.cabin_class ? CABIN_LABELS[f.cabin_class] || f.cabin_class : ''
                  return (
                    <div key={i} className="break-inside-avoid text-[0.78em] leading-snug mb-[0.35em] last:mb-0">
                      <span className="font-semibold">{group.label}: </span>
                      {[f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' → ') || '—'}
                      {f.airline ? ` · ${f.airline}` : ''}
                      {f.date ? ` · ${fmtDate(f.date)}` : ''}
                      {f.duration_label ? ` · ${f.duration_label}` : ''}
                      {cabin ? ` · ${cabin}` : ''}
                      {bag ? ` · ${bag}` : ''}
                      {f.stopover_label && <span className="block text-gray-500">{f.stopover_label}</span>}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}

        {flightsHtmlText && legGroups.length === 0 && (
          <div className={`${DENSITY_GAP[density]} break-inside-avoid`}>
            <SectionLabel>Voos</SectionLabel>
            <p className="text-[0.78em] whitespace-pre-wrap">{flightsHtmlText}</p>
          </div>
        )}

        {hasTours && (
          <div className={`${DENSITY_GAP[density]} break-inside-avoid`}>
            <SectionLabel>Passeios e ingressos</SectionLabel>
            <Rich html={quotation.tours_html} onReady={onRichReady} className="text-[0.78em] leading-snug [&_p]:mb-[0.3em] [&_ul]:list-disc [&_ul]:pl-[1.2em] [&_ol]:list-decimal [&_ol]:pl-[1.2em]" />
          </div>
        )}

        {/* ── Inclui / Não inclui ────────────────────────────────── */}
        {hasIncludedExcluded && (
          <div className={`${DENSITY_GAP[density]} grid grid-cols-2 gap-x-[1.2em] break-inside-avoid`}>
            {(quotation.included?.length ?? 0) > 0 && (
              <div>
                <SectionLabel>Inclui</SectionLabel>
                <ul className="space-y-[0.2em]">
                  {quotation.included!.map((item, i) => (
                    <li key={i} className="text-[0.76em] flex items-start gap-[0.4em]"><Check className="w-[0.85em] h-[0.85em] mt-[0.15em] shrink-0" /> {item}</li>
                  ))}
                </ul>
              </div>
            )}
            {(quotation.not_included?.length ?? 0) > 0 && (
              <div>
                <SectionLabel>Não inclui</SectionLabel>
                <ul className="space-y-[0.2em]">
                  {quotation.not_included!.map((item, i) => (
                    <li key={i} className="text-[0.76em] flex items-start gap-[0.4em] text-gray-600"><X className="w-[0.85em] h-[0.85em] mt-[0.15em] shrink-0" /> {item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ── Investimento ───────────────────────────────────────── */}
        <div className={`${DENSITY_GAP[density]} border-t-2 border-red-600 pt-[0.7em] break-inside-avoid`}>
          <p className="font-bold text-[0.8em] uppercase tracking-wide mb-[0.3em]">Investimento da viagem</p>
          <p className="text-[1.9em] font-bold text-red-600 leading-none tabular-nums">{fmtCurrency(quotation.total_cents)}</p>
          {quotation.price_per_person_cents != null && quotation.price_per_person_cents > 0 && (
            <p className="text-[0.78em] text-gray-600 mt-[0.25em]">{fmtCurrency(quotation.price_per_person_cents)} por pessoa</p>
          )}
          {(quotation.payment_conditions?.length ?? 0) > 0 && (
            <ul className="mt-[0.5em] space-y-[0.15em]">
              {quotation.payment_conditions!.map((p, i) => (
                <li key={i} className="text-[0.76em]">• {p.label}{p.value ? ` — ${p.value}` : ''}</li>
              ))}
            </ul>
          )}
          {quotation.price_disclaimer && (
            <p className="text-[0.68em] text-gray-500 mt-[0.5em] whitespace-pre-wrap">{quotation.price_disclaimer}</p>
          )}
        </div>

        {/* ── Validade / Cancelamento ────────────────────────────── */}
        {(hasValidity || cancellationHasContent) && (
          <div className={`${DENSITY_GAP[density]} grid ${hasValidity && cancellationHasContent ? 'grid-cols-2' : 'grid-cols-1'} gap-x-[1.2em] break-inside-avoid`}>
            {hasValidity && (
              <div>
                <SectionLabel>Validade da tarifa</SectionLabel>
                <p className="text-[0.76em] text-gray-700">
                  Tarifa válida por {quotation.validity_days} dia{quotation.validity_days === 1 ? '' : 's'} a partir de {fmtDate(quotation.quoted_at || quotation.created_at)}, sujeita à disponibilidade até a confirmação da reserva.
                </p>
              </div>
            )}
            {cancellationHasContent && (
              <div>
                <SectionLabel>Política de cancelamento</SectionLabel>
                <Rich html={quotation.cancellation_html} onReady={onRichReady} className="text-[0.76em] leading-snug text-gray-700 [&_p]:mb-[0.25em] [&_ul]:list-disc [&_ul]:pl-[1.1em]" />
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        {(org.cnpj || org.cadastur) && (
          <div className="pt-[0.6em] mt-[0.6em] border-t border-gray-200 text-center text-[0.6em] text-gray-400 break-inside-avoid">
            {[org.cnpj && `CNPJ ${org.cnpj}`, org.cadastur && `CADASTUR ${org.cadastur}`].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.6em] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-[0.8em] font-medium truncate">{value}</p>
    </div>
  )
}

