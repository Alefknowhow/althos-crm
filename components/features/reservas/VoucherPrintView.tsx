'use client'

import { Fragment } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Printer, MapPin, ArrowLeft, MessageCircle, Mail,
  Info, AlertTriangle, Sparkles, Hash, Phone, Globe,
} from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'
import {
  fmtDate, nights, CompactField, InfoRow,
  type OrgBranding, type ContatoInfo, type VooProduct, type HospedagemProduct, type GenericProduct,
} from './VoucherPrintHelpers'
import {
  FlightsSection, HotelSection, TransfersSection, CruiseSection, ToursSection, ServicesSection, InsuranceSection,
} from './VoucherPrintSections'

export default function VoucherPrintView({
  sale, org, contato, voos = [], hospedagens = [], transfers = [], cruzeiros = [], ingressos = [], seguros = [],
}: {
  sale: TravelSaleRow
  org: OrgBranding
  contato?: ContatoInfo
  voos?: VooProduct[]
  hospedagens?: HospedagemProduct[]
  transfers?: GenericProduct[]
  cruzeiros?: GenericProduct[]
  /** Produtos kind='ingresso' ou 'passeio' — mesma seção no voucher. */
  ingressos?: GenericProduct[]
  seguros?: GenericProduct[]
}) {
  const accent = org.primary_color || '#0f62fe'
  const included: string[] = Array.isArray(sale.included_items) ? sale.included_items : []
  const services: string[] = Array.isArray(sale.services) ? sale.services : []
  const all = [...included, ...services]
  const hasVoos = voos.length > 0 || all.includes('voos') || !!sale.airline || !!sale.air_locator
  const hasHotel = hospedagens.length > 0 || all.includes('hospedagem') || !!sale.hotel_name
  const hasTraslado = transfers.length > 0 || all.includes('transfer')
  const hasCruzeiro = cruzeiros.length > 0 || all.includes('cruzeiros')
  const hasPasseios = ingressos.length > 0 || all.includes('passeios') || all.includes('ingressos')
  const hasServicos = all.includes('servicos') || all.includes('carros') || all.includes('car_rental')
  const hasSeguro = seguros.length > 0 || all.includes('seguro') || all.includes('insurance')
  const travelers: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(sale.travelers) ? sale.travelers : []
  const n = nights(sale.departure_date, sale.return_date)

  const qrData = sale.airline_checkin_url
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(sale.airline_checkin_url)}`
    : null

  const shareMessage = `Olá ${sale.client_name || ''}! Segue o voucher da sua viagem para ${sale.destination || 'sua viagem'} — anexo o PDF em seguida.`
  const waDigits = contato?.phone ? contato.phone.replace(/\D/g, '') : null
  const waUrl = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(shareMessage)}` : null
  const mailUrl = contato?.email
    ? `mailto:${contato.email}?subject=${encodeURIComponent(`Voucher — ${sale.destination || 'sua viagem'}`)}&body=${encodeURIComponent(shareMessage)}`
    : null

  return (
    <div className="min-h-screen bg-muted/30 py-8 print:bg-white print:py-0">
      <div className="max-w-[210mm] mx-auto print:hidden mb-4 px-4 flex items-center justify-between gap-2 flex-wrap">
        <Link href={`/app`} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 shrink-0" onClick={e => { e.preventDefault(); window.close() }}>
          <ArrowLeft className="w-3 h-3" /> Fechar
        </Link>
        <div className="flex items-center gap-2 flex-wrap">
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" title="Abre o WhatsApp com uma mensagem pronta — anexe o PDF manualmente">
                <MessageCircle className="w-4 h-4 mr-1.5 text-green-600" /> Enviar por WhatsApp
              </Button>
            </a>
          )}
          {mailUrl && (
            <a href={mailUrl}>
              <Button variant="outline" title="Abre seu cliente de e-mail com uma mensagem pronta — anexe o PDF manualmente">
                <Mail className="w-4 h-4 mr-1.5" /> Enviar por e-mail
              </Button>
            </a>
          )}
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir / Salvar PDF
          </Button>
        </div>
      </div>

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-0 min-h-[297mm]">
        {/* Cabeçalho da agência + caixa de referência */}
        <div className="flex items-start justify-between gap-4 border-b-2 pb-6 mb-6 break-inside-avoid" style={{ borderColor: accent }}>
          <div className="flex items-center gap-3">
            {org.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={org.logo_url} alt={org.name} className="h-14 w-auto object-contain" />
            )}
            <div>
              <p className="text-lg font-bold">{org.name}</p>
              {(org.cnpj || org.cadastur) && (
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {org.cnpj && <>CNPJ {org.cnpj}</>}
                  {org.cnpj && org.cadastur && ' · '}
                  {org.cadastur && <>CADASTUR {org.cadastur}</>}
                </p>
              )}
              <div className="mt-1 space-y-0.5">
                {org.contact_phone && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" /> {org.contact_phone}</p>
                )}
                {org.contact_email && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Mail className="w-3 h-3 shrink-0" /> {org.contact_email}</p>
                )}
                {org.website && (
                  <p className="text-[11px] text-gray-500 flex items-center gap-1"><Globe className="w-3 h-3 shrink-0" /> {org.website}</p>
                )}
              </div>
            </div>
          </div>
          <div className="text-right rounded-md border p-3 min-w-[180px]">
            <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Voucher de viagem</p>
            <p className="text-sm font-mono font-semibold" style={{ color: accent }}>{sale.package_locator || '—'}</p>
            <p className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Resumo (destino/período) + viajantes — bloco único e compacto.
            Titular é a primeira linha da lista de viajantes (mesmo padrão
            das demais), não um campo separado. */}
        <div className="mb-6 border rounded-md overflow-hidden break-inside-avoid">
          <div className="px-3 py-2 space-y-1">
            <div>
              <CompactField label="Destino" value={sale.destination} />
            </div>
            <div>
              <CompactField
                label="Período"
                value={sale.departure_date || sale.return_date ? <>{fmtDate(sale.departure_date)} → {fmtDate(sale.return_date)}{n ? ` (${n} noite${n > 1 ? 's' : ''})` : ''}</> : '—'}
              />
            </div>
          </div>
          {/* Nomes e datas em colunas de verdade (grid único cobrindo todas
              as linhas) — cabeçalho "Nome / Nascimento", titular destacado
              só por um badge, sem repetir rótulo em cada linha. */}
          <div className="grid grid-cols-[40ch_100px_1fr] border-t">
            <div className="px-3 py-1 bg-gray-50 border-b text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Nome</div>
            <div className="px-3 py-1 bg-gray-50 border-b text-[9px] uppercase tracking-wide text-gray-400 font-semibold">Nascimento</div>
            <div className="bg-gray-50 border-b" />

            <div className={`px-3 py-1.5 text-[11px] font-semibold flex items-center gap-1.5 ${travelers.length > 0 ? 'border-b' : ''}`}>
              {sale.client_name || '—'}
              <span
                className="text-[8px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-full"
                style={{ backgroundColor: `${accent}20`, color: accent }}
              >
                Titular
              </span>
            </div>
            <div className={`px-3 py-1.5 text-[11px] tabular-nums ${travelers.length > 0 ? 'border-b' : ''}`}>
              {contato?.date_of_birth ? fmtDate(contato.date_of_birth) : '—'}
            </div>
            <div className={travelers.length > 0 ? 'border-b' : ''} />

            {travelers.map((t, i) => (
              <Fragment key={i}>
                <div className={`px-3 py-1.5 text-[11px] break-inside-avoid ${i < travelers.length - 1 ? 'border-b' : ''}`}>{t.name}</div>
                <div className={`px-3 py-1.5 text-[11px] tabular-nums ${i < travelers.length - 1 ? 'border-b' : ''}`}>{t.birth_date ? fmtDate(t.birth_date) : '—'}</div>
                <div className={i < travelers.length - 1 ? 'border-b' : ''} />
              </Fragment>
            ))}
          </div>
        </div>

        {/* Seções de serviços — cada bloco só aparece se contratado */}
        <div className="space-y-4 mb-6">
          {hasVoos && <FlightsSection sale={sale} accent={accent} voos={voos} />}
          {hasHotel && <HotelSection sale={sale} accent={accent} hospedagens={hospedagens} />}
          {hasTraslado && <TransfersSection sale={sale} accent={accent} transfers={transfers} />}
          {hasCruzeiro && <CruiseSection sale={sale} accent={accent} cruzeiros={cruzeiros} />}
          {hasPasseios && <ToursSection sale={sale} accent={accent} ingressos={ingressos} />}
          {hasServicos && <ServicesSection accent={accent} all={all} />}
          {hasSeguro && <InsuranceSection sale={sale} accent={accent} seguros={seguros} />}
        </div>

        {/* Operadora — sem informação de pagamento no voucher */}
        {sale.operator && (
          <div className="mb-6 rounded-md border p-4 break-inside-avoid">
            <InfoRow label="Operadora" value={sale.operator} />
          </div>
        )}

        {/* Política de cancelamento — bloco em destaque, igual ao modelo de referência */}
        {sale.cancellation_policy && (
          <div className="mb-6 rounded-md border-2 p-4 break-inside-avoid" style={{ borderColor: '#f59e0b' }}>
            <p className="text-xs uppercase tracking-wide font-bold mb-1.5 flex items-center gap-1.5" style={{ color: '#b45309' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> Política de cancelamento
            </p>
            <p className="text-xs whitespace-pre-wrap text-gray-700">{sale.cancellation_policy}</p>
          </div>
        )}

        {sale.important_info && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Informações importantes
            </p>
            <p className="text-xs whitespace-pre-wrap">{sale.important_info}</p>
          </div>
        )}

        {sale.service_info && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Informações de serviço
            </p>
            <p className="text-xs whitespace-pre-wrap">{sale.service_info}</p>
          </div>
        )}

        {sale.notes && (
          <div className="mb-6 break-inside-avoid">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Observações</p>
            <p className="text-xs whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        {qrData && (
          <div className="flex flex-col items-center gap-2 mt-auto pt-6 break-inside-avoid">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData} alt="QR code de check-in" className="w-32 h-32" />
            <p className="text-[11px] text-gray-500">Aponte a câmera para acessar o check-in online</p>
          </div>
        )}

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400 space-y-1 break-inside-avoid">
          {(org.address_street || org.address_city) && (
            <p className="flex items-center justify-center gap-1">
              <MapPin className="w-3 h-3 shrink-0" />
              {[org.address_street, org.address_city, org.address_state, org.address_zip].filter(Boolean).join(', ')}
            </p>
          )}
          <p className="flex items-center justify-center gap-1">
            <Hash className="w-3 h-3" /> Documento gerado por {org.name} — apresente este voucher junto a um documento de identificação.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          /* Margens reais em todos os lados — antes só a base tinha
             margem, topo/laterais ficavam a 0 e o conteúdo colava na
             borda física do papel. */
          @page { size: A4; margin: 15mm 14mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          /* break-inside:avoid não encolhe o bloco — só impede que ele seja
             cortado ao meio: se não couber no espaço restante da página,
             o navegador empurra o bloco inteiro pra próxima. Aplicado em
             cada seção (voo/hospedagem/produto) e em cada item dentro dela,
             pra nunca partir um card de produto ao meio. */
          .break-inside-avoid { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>
    </div>
  )
}
