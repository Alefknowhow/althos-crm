'use client'

/**
 * Documento comercial da cotação (A4, multi-página) — gerado via
 * window.print() (sem headless-Chrome/puppeteer: o navegador do usuário é
 * o motor de PDF). Reaproveita 100% os dados já existentes em
 * travel_proposals/quotation_products (ver actions/quotations.ts,
 * getQuotationFull) — nenhum campo novo foi criado no banco.
 *
 * Arquitetura: DATA (props) → normalização por tipo → registry
 * product_type → card component (QuotationPrintCards.tsx) → layout do
 * documento → paginação via CSS (break-inside: avoid em cada card, sem
 * scaling/compactação artificial — ao contrário da versão anterior deste
 * componente, este documento CRESCE verticalmente por quantas páginas
 * forem necessárias; nunca corta ou encolhe conteúdo pra caber em 1 página).
 *
 * Regra absoluta de precificação: o único valor monetário exibido no
 * documento é quotation.total_cents (box "Total da viagem"). Nenhum card
 * de produto mostra preço individual, subtotal ou taxa — mesmo quando o
 * produto tem price_cents/cabin_options com valor próprio no banco (usado
 * só internamente/no editor). Ver PRODUCT_LABELS/ProductCard em
 * QuotationPrintCards.tsx.
 *
 * QR Code de pagamento: o modelo atual de cotação não tem link/pagamento
 * online por cotação (não existe integração Asaas nesse nível) — o prop
 * `payment` é opcional e, ausente/disabled, simplesmente não renderiza o
 * QR (o header se reorganiza sozinho por ser flex). Fica pronto pra plugar
 * quando essa feature existir, sem precisar mexer no layout de novo.
 */

import { useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, ArrowLeft, Check, X, Phone, Mail, User } from 'lucide-react'
import {
  fmtDate, fmtCurrency, fmtDateExtenso, fmtPhone, fmtCep, stripHtml, hasHtml,
  Rich, ProductCard,
  type OrgBranding, type Seller, type Payment, type Product, type Quotation,
} from './QuotationPrintCards'
import { FlightCard, FlightsTextCard } from './QuotationPrintFlightCard'

export default function QuotationPrintView({
  quotation, products, org, seller = null, payment = null,
}: {
  quotation: Quotation
  products: Product[]
  org: OrgBranding
  seller?: Seller
  payment?: Payment
}) {
  const addressLine = [
    org.address_street,
    [org.address_city, org.address_state].filter(Boolean).join(' - '),
    fmtCep(org.address_zip) && `CEP ${fmtCep(org.address_zip)}`,
  ].filter(Boolean).join(' · ') || null

  const destinations = (quotation.destinations || []).map(d => d.name).filter(Boolean).join(', ')
  const paxLine = quotation.pax_adults
    ? `${quotation.pax_adults} adulto${quotation.pax_adults === 1 ? '' : 's'}${quotation.pax_children ? ` e ${quotation.pax_children} criança${quotation.pax_children === 1 ? '' : 's'}` : ''}`
    : ''

  const flightLegs = products.filter(p => p.type === 'aereo').map(p => p.data)
  const flightsHtmlText = stripHtml(quotation.flights_html)
  const fareConditions = quotation.flight_fare_conditions || []

  // Unidades de renderização, na ordem em que os produtos foram salvos —
  // todas as pernas de voo viram UM card único (o card é indivisível: um
  // "Aéreo" com ida/volta/conexão, não um card por perna).
  const renderUnits = useMemo(() => {
    const units: { key: string; node: React.ReactNode }[] = []
    let flightsConsumed = false
    for (const p of products) {
      if (p.type === 'aereo') {
        if (flightsConsumed) continue
        flightsConsumed = true
        units.push({ key: 'flights', node: <FlightCard legs={flightLegs} fareConditions={fareConditions} /> })
        continue
      }
      units.push({ key: p.id, node: <ProductCard p={p} /> })
    }
    if (!flightsConsumed && flightsHtmlText) {
      units.unshift({ key: 'flights-text', node: <FlightsTextCard text={flightsHtmlText} /> })
    }
    return units
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, flightsHtmlText, paxLine, fareConditions])

  const hasIncludedExcluded = (quotation.included?.length ?? 0) > 0 || (quotation.not_included?.length ?? 0) > 0
  const cancellationHasContent = hasHtml(quotation.cancellation_html)
  const importantHasContent = hasHtml(quotation.important_html)
  const quotedDateExtenso = fmtDateExtenso(quotation.created_at)

  const paymentConditions = (quotation.payment_conditions || []).reduce<{ label: string; value?: string | null }[]>((acc, p) => {
    const dup = acc.find(x => (x.value || '').trim() && x.value === p.value)
    if (dup) { dup.label = `${dup.label} / ${p.label}`; return acc }
    acc.push({ ...p })
    return acc
  }, [])

  const qrVisible = !!payment?.enabled && !!payment?.qr_code

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between">
        <a href="/app" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </a>
        <Button onClick={() => window.print()}>
          <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
        </Button>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-[#111] shadow-sm print:shadow-none doc-page">
        {/* ── Header: logo | agência | vendedor | QR ─────────────── */}
        <div className="flex items-start justify-between gap-[4mm] pb-[4mm] mb-[5mm] border-b-[0.8pt] border-[#BDBDBD] avoid-break">
          {org.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={org.logo_url} alt={org.name} className="shrink-0" style={{ maxWidth: '35mm', maxHeight: '28mm', objectFit: 'contain' }} />
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[9pt] leading-snug"><span className="font-bold">Agência:</span> <span className="font-bold">{org.name}</span></p>
            {org.contact_phone && <p className="text-[8pt] text-[#555] leading-snug mt-[0.5mm]">{fmtPhone(org.contact_phone)}</p>}
            {org.contact_email && <p className="text-[8pt] text-[#555] leading-snug">{org.contact_email}</p>}
            {org.website && <p className="text-[8pt] text-[#555] leading-snug">{org.website}</p>}
            {addressLine && <p className="text-[8pt] text-[#555] leading-snug mt-[1.5mm]">{addressLine}</p>}
            {org.cnpj && <p className="text-[7pt] text-[#777] leading-snug mt-[0.5mm]">CNPJ {org.cnpj}{org.cadastur ? ` · CADASTUR ${org.cadastur}` : ''}</p>}
          </div>

          {seller && (
            <div className="min-w-0 shrink-0 text-right">
              <p className="text-[9pt] font-bold text-[#111] flex items-center justify-end gap-[1.2mm]"><User className="w-[3mm] h-[3mm] text-[#555]" /> {seller.name}</p>
              {seller.phone && <p className="text-[8pt] text-[#555] flex items-center justify-end gap-[1.2mm]"><Phone className="w-[2.8mm] h-[2.8mm]" /> {seller.phone}</p>}
              {seller.email && <p className="text-[8pt] text-[#555] flex items-center justify-end gap-[1.2mm]"><Mail className="w-[2.8mm] h-[2.8mm]" /> {seller.email}</p>}
            </div>
          )}

          {qrVisible && (
            <div className="shrink-0 text-center">
              <p className="text-[7pt] text-[#555] mb-[1mm] max-w-[25mm]">Leia o QR code e realize o pagamento online</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payment!.qr_code!} alt="QR Code de pagamento" style={{ width: '25mm', height: '25mm' }} />
            </div>
          )}
        </div>

        {/* ── Cabeçalho da cotação: título + data + Total ─────────── */}
        <div className="flex items-start justify-between gap-[4mm] mb-[3mm] avoid-break">
          <div className="min-w-0">
            <p className="text-[17pt] font-bold leading-tight" style={{ color: '#172A9B' }}>Orçamento da sua viagem</p>
            {quotedDateExtenso && <p className="text-[8.5pt] text-[#555] mt-[1mm]">Esta cotação foi realizada no dia {quotedDateExtenso}</p>}
          </div>
          <div className="shrink-0 flex items-start gap-[3mm]">
            {paymentConditions.length > 0 && (
              <div className="border-[0.8pt] border-[#C9C9C9] rounded-[5mm] px-[4mm] py-[3.5mm]">
                <p className="text-[7pt] font-bold uppercase tracking-wide text-[#777] mb-[1.5mm]">Forma de pagamento</p>
                <ul className="space-y-[0.5mm]">
                  {paymentConditions.map((p, i) => (
                    <li key={i} className="text-[7.5pt] text-[#555] whitespace-nowrap">• {p.label}{p.value ? ` — ${p.value}` : ''}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="border-[0.8pt] border-[#C9C9C9] rounded-[5mm] px-[5mm] py-[4mm] text-right">
              <p className="text-[7.5pt] uppercase tracking-wide text-[#777] mb-[1mm]">Total da viagem</p>
              <p className="text-[16pt] font-bold text-[#111] tabular-nums">{fmtCurrency(quotation.total_cents)}</p>
              <p className="text-[6.5pt] text-[#777] mt-[0.5mm]">Taxas e impostos incluídos</p>
            </div>
          </div>
        </div>

        {/* ── Cliente / destino / datas / pax + etiquetas de tarifa ── */}
        <div className="mb-[4mm] avoid-break">
          <div className="grid grid-cols-2 gap-x-[3mm] gap-y-[1.5mm]">
            {quotation.client_name && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Nome do Cliente:</span> {quotation.client_name}</p>}
            {destinations && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Destino:</span> {destinations}</p>}
            {fmtDate(quotation.start_date) && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Data de ida:</span> {fmtDate(quotation.start_date)}</p>}
            {fmtDate(quotation.end_date) && <p className="text-[8.5pt] text-[#111]"><span className="text-[#777]">Data de retorno:</span> {fmtDate(quotation.end_date)}</p>}
          </div>
          {paxLine && <p className="text-[7.5pt] text-[#555] mt-[2mm]">{paxLine}</p>}
        </div>

        {/* ── ⚠️ ATENÇÃO — único bloco com vermelho no documento ───── */}
        <div className="border border-red-200 bg-red-50 px-[3mm] py-[2mm] mb-[5mm] avoid-break">
          <p className="text-[7pt] leading-snug text-red-900">
            <span className="font-bold">ATENÇÃO — </span>
            Esta é uma simples cotação. Nenhum dos componentes selecionados está confirmado até que seja efetivada a reserva. Os valores podem sofrer alterações em virtude de disponibilidade e câmbio.
          </p>
        </div>

        {/* ── Product Cards ─────────────────────────────────────── */}
        {renderUnits.map(u => <div key={u.key}>{u.node}</div>)}

        {/* ── Informações importantes ───────────────────────────── */}
        {(importantHasContent || quotation.price_disclaimer) && (
          <div className="mb-[5mm] avoid-break">
            <p className="text-[11pt] font-bold text-[#111] mb-[1.5mm]">Informações importantes</p>
            {importantHasContent && (
              <Rich html={quotation.important_html} className="text-[7pt] leading-snug text-[#555] [&_p]:mb-[1mm] [&_ul]:list-disc [&_ul]:pl-[4mm]" />
            )}
            {quotation.price_disclaimer && (
              <p className="text-[7pt] text-[#555] whitespace-pre-wrap mt-[1mm]">{quotation.price_disclaimer}</p>
            )}
          </div>
        )}

        {/* ── Política de cancelamento ──────────────────────────── */}
        {cancellationHasContent && (
          <div className="mb-[5mm] avoid-break">
            <p className="text-[11pt] font-bold text-[#111] mb-[1.5mm]">Política de cancelamento</p>
            <Rich html={quotation.cancellation_html} className="text-[7.5pt] leading-snug text-[#555] [&_p]:mb-[1mm] [&_ul]:list-disc [&_ul]:pl-[4mm]" />
          </div>
        )}

        {/* ── Inclui / Não inclui — card único, listas horizontais ── */}
        {hasIncludedExcluded && (
          <div className="border-[0.8pt] border-[#D0D0D0] rounded-[4mm] p-[4mm] mb-[5mm] avoid-break">
            {(quotation.included?.length ?? 0) > 0 && (
              <div className={(quotation.not_included?.length ?? 0) > 0 ? 'mb-[2.5mm] pb-[2.5mm] border-b-[0.6pt] border-[#D0D0D0]' : undefined}>
                <p className="text-[9pt] font-bold text-[#111] mb-[1.5mm]">Incluso</p>
                <div className="flex flex-wrap gap-x-[4mm] gap-y-[1mm]">
                  {quotation.included!.map((item, i) => (
                    <span key={i} className="text-[7.5pt] flex items-center gap-[1mm] whitespace-nowrap"><Check className="w-[3mm] h-[3mm] shrink-0 text-[#16845B]" /> {item}</span>
                  ))}
                </div>
              </div>
            )}
            {(quotation.not_included?.length ?? 0) > 0 && (
              <div>
                <p className="text-[9pt] font-bold text-[#111] mb-[1.5mm]">Não incluso</p>
                <div className="flex flex-wrap gap-x-[4mm] gap-y-[1mm]">
                  {quotation.not_included!.map((item, i) => (
                    <span key={i} className="text-[7.5pt] flex items-center gap-[1mm] text-[#555] whitespace-nowrap"><X className="w-[3mm] h-[3mm] shrink-0 text-[#C04A4A]" /> {item}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Footer ─────────────────────────────────────────────── */}
        <div className="pt-[3mm] mt-[3mm] border-t-[0.6pt] border-[#D0D0D0] text-right avoid-break">
          <p className="text-[6pt] text-[#777]">ID da cotação: {quotation.id}</p>
        </div>
      </div>

      <style>{`
        .doc-page {
          width: 210mm;
          font-family: Arial, Helvetica, sans-serif;
          padding: 8mm 10mm;
        }
        @media print {
          /* Margem no @page (não no padding do .doc-page) porque é a única
             forma de aplicar o mesmo respiro em TODAS as páginas físicas —
             um padding no elemento só afeta o topo da primeira página e o
             fim da última quando o conteúdo é paginado pelo navegador. */
          @page { size: A4; margin: 10mm 0; }
          .doc-page { padding: 0 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .avoid-break { break-inside: avoid; page-break-inside: avoid; }
        }
        @media screen {
          .doc-page { margin-bottom: 24px; }
        }
      `}</style>
    </div>
  )
}
