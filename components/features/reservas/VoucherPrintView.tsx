'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Printer, MapPin, Plane, Hotel, Car, ShieldCheck, ArrowLeft, MessageCircle, Mail,
  Users, CalendarDays, Info, AlertTriangle, Compass, Ticket, Sparkles, Hash, Phone, Globe,
} from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

type OrgBranding = {
  name: string
  logo_url: string | null
  primary_color: string | null
  cnpj: string | null
  cadastur: string | null
  contact_phone: string | null
  contact_email: string | null
  website: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
}

type ContatoInfo = { phone: string | null; email: string | null } | null

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'
}

function nights(a?: string | null, b?: string | null) {
  if (!a || !b) return null
  const ms = new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()
  const n = Math.round(ms / 86400000)
  return n > 0 ? n : null
}

// Cabeçalho de seção — barra sólida na cor da marca, ícone + título, no
// mesmo espírito das barras "VOUCHER DE HOTEL / VOUCHER DE VOO" do modelo
// de referência (operadora azul).
function SectionBar({ icon: Icon, title, accent }: { icon: React.ElementType; title: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-t-md text-white text-xs font-bold uppercase tracking-wide" style={{ backgroundColor: accent }}>
      <Icon className="w-3.5 h-3.5" /> {title}
    </div>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className={`text-sm ${mono ? 'font-mono' : ''}`}>{value ?? '—'}</p>
    </div>
  )
}

export default function VoucherPrintView({ sale, org, contato }: { sale: TravelSaleRow; org: OrgBranding; contato?: ContatoInfo }) {
  const accent = org.primary_color || '#0f62fe'
  const included: string[] = Array.isArray(sale.included_items) ? sale.included_items : []
  const services: string[] = Array.isArray(sale.services) ? sale.services : []
  const all = [...included, ...services]
  const hasVoos = all.includes('voos') || !!sale.airline || !!sale.air_locator
  const hasHotel = all.includes('hospedagem') || !!sale.hotel_name
  const hasTraslado = all.includes('transfer')
  const hasPasseios = all.includes('passeios')
  const hasServicos = all.includes('servicos') || all.includes('carros') || all.includes('ingressos') || all.includes('car_rental')
  const hasSeguro = all.includes('seguro') || all.includes('insurance')
  const travelers: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(sale.travelers) ? sale.travelers : []
  const flights = Array.isArray(sale.flights) ? sale.flights : []
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

      <div className="max-w-[210mm] mx-auto bg-white text-black shadow-sm print:shadow-none p-10 print:p-8 min-h-[297mm]">
        {/* Cabeçalho da agência + caixa de referência */}
        <div className="flex items-start justify-between gap-4 border-b-2 pb-6 mb-6" style={{ borderColor: accent }}>
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
            <p className="text-sm font-mono font-semibold" style={{ color: accent }}>#{sale.sale_number || sale.id.slice(0, 8).toUpperCase()}</p>
            {sale.package_locator && (
              <p className="text-[11px] text-gray-500 mt-1">Localizador: <span className="font-mono">{sale.package_locator}</span></p>
            )}
            <p className="text-[10px] text-gray-400 mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {/* Cliente + resumo rápido */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <InfoRow label="Cliente" value={<span className="font-semibold">{sale.client_name || '—'}</span>} />
          <InfoRow label="Destino" value={sale.destination} />
          <InfoRow
            label="Período"
            value={sale.departure_date || sale.return_date ? <>{fmtDate(sale.departure_date)} → {fmtDate(sale.return_date)}{n ? ` (${n} noite${n > 1 ? 's' : ''})` : ''}</> : '—'}
          />
        </div>

        {/* Viajantes */}
        {travelers.length > 0 && (
          <div className="mb-6 border rounded-md overflow-hidden">
            <SectionBar icon={Users} title="Viajantes" accent={accent} />
            <div className="divide-y">
              {travelers.map((t, i) => (
                <div key={i} className="grid grid-cols-3 gap-4 px-3 py-2">
                  <InfoRow label="Nome" value={t.name} />
                  <InfoRow label="Data de nascimento" value={t.birth_date ? fmtDate(t.birth_date) : '—'} />
                  <InfoRow label="CPF" value={t.cpf} mono />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Seções de serviços — cada bloco só aparece se contratado */}
        <div className="space-y-4 mb-6">
          {hasVoos && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={Plane} title="Voos" accent={accent} />
              {sale.air_locator && (
                <div className="px-3 pt-3">
                  <InfoRow label="Localizador (PNR)" value={sale.air_locator} mono />
                </div>
              )}
              {flights.length > 0 ? (
                <div className="divide-y">
                  {(['ida', 'volta'] as const).map(dir => {
                    const legs = flights.filter(f => f.sentido === dir)
                    if (legs.length === 0) return null
                    return (
                      <div key={dir} className="p-3">
                        <p className="text-[10px] uppercase tracking-wide font-bold mb-1.5" style={{ color: accent }}>{dir}</p>
                        <div className="space-y-2">
                          {legs.map((f, i) => (
                            <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <InfoRow label="Trecho" value={f.origem && f.destino ? `${f.origem} → ${f.destino}` : (f.origem || f.destino)} />
                              <InfoRow label="Companhia / voo" value={[f.companhia, f.numero].filter(Boolean).join(' · ') || '—'} />
                              <InfoRow label="Data" value={fmtDate(f.data)} />
                              <InfoRow label="Horário" value={f.horario} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                  {flights.some(f => !f.sentido) && (
                    <div className="p-3">
                      {flights.filter(f => !f.sentido).map((f, i) => (
                        <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <InfoRow label="Trecho" value={f.origem && f.destino ? `${f.origem} → ${f.destino}` : (f.origem || f.destino)} />
                          <InfoRow label="Companhia / voo" value={[f.companhia, f.numero].filter(Boolean).join(' · ') || '—'} />
                          <InfoRow label="Data" value={fmtDate(f.data)} />
                          <InfoRow label="Horário" value={f.horario} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 p-3">
                  <InfoRow label="Companhia aérea" value={sale.airline} />
                  <InfoRow label="Data de ida" value={fmtDate(sale.departure_date)} />
                  <InfoRow label="Data de volta" value={fmtDate(sale.return_date)} />
                </div>
              )}
            </div>
          )}

          {hasHotel && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={Hotel} title="Hospedagem" accent={accent} />
              <div className="grid grid-cols-2 gap-4 p-3">
                <InfoRow label="Hotel" value={sale.hotel_name} />
                <InfoRow label="Localização" value={sale.destination} />
                <InfoRow label="Check-in" value={fmtDate(sale.departure_date)} />
                <InfoRow label="Check-out" value={fmtDate(sale.return_date)} />
              </div>
            </div>
          )}

          {hasTraslado && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={Car} title="Traslados" accent={accent} />
              <div className="p-3 text-sm text-gray-600">
                Traslado incluso no pacote — chegada e saída conforme itinerário combinado.
              </div>
            </div>
          )}

          {hasPasseios && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={Compass} title="Passeios" accent={accent} />
              <div className="p-3 text-sm text-gray-600">
                Passeios inclusos no pacote — consulte roteiro e horários com o guia local.
              </div>
            </div>
          )}

          {hasServicos && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={Ticket} title="Serviços" accent={accent} />
              <div className="flex gap-1.5 flex-wrap p-3">
                {(all.includes('carros') || all.includes('car_rental')) && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Locação de carro</span>}
                {all.includes('ingressos') && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Ingressos</span>}
                {all.includes('servicos') && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Serviços diversos</span>}
              </div>
            </div>
          )}

          {hasSeguro && (
            <div className="border rounded-md overflow-hidden">
              <SectionBar icon={ShieldCheck} title="Seguro viagem" accent={accent} />
              <div className="p-3 text-sm text-gray-600">
                Seguro viagem incluso — mantenha este voucher e o cartão do seguro em mãos durante a viagem.
              </div>
            </div>
          )}
        </div>

        {/* Operadora / pagamento */}
        <div className="grid grid-cols-2 gap-4 mb-6 rounded-md border p-4">
          <InfoRow label="Operadora" value={sale.operator} />
          <InfoRow label="Forma de pagamento" value={sale.payment_method} />
        </div>

        {/* Política de cancelamento — bloco em destaque, igual ao modelo de referência */}
        {sale.cancellation_policy && (
          <div className="mb-6 rounded-md border-2 p-4" style={{ borderColor: '#f59e0b' }}>
            <p className="text-xs uppercase tracking-wide font-bold mb-1.5 flex items-center gap-1.5" style={{ color: '#b45309' }}>
              <AlertTriangle className="w-3.5 h-3.5" /> Política de cancelamento
            </p>
            <p className="text-sm whitespace-pre-wrap text-gray-700">{sale.cancellation_policy}</p>
          </div>
        )}

        {sale.important_info && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5" /> Informações importantes
            </p>
            <p className="text-sm whitespace-pre-wrap">{sale.important_info}</p>
          </div>
        )}

        {sale.service_info && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Informações de serviço
            </p>
            <p className="text-sm whitespace-pre-wrap">{sale.service_info}</p>
          </div>
        )}

        {sale.notes && (
          <div className="mb-6">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold mb-1">Observações</p>
            <p className="text-sm whitespace-pre-wrap">{sale.notes}</p>
          </div>
        )}

        {qrData && (
          <div className="flex flex-col items-center gap-2 mt-auto pt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrData} alt="QR code de check-in" className="w-32 h-32" />
            <p className="text-[11px] text-gray-500">Aponte a câmera para acessar o check-in online</p>
          </div>
        )}

        <div className="mt-10 pt-4 border-t text-center text-[10px] text-gray-400 space-y-1">
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
          @page { size: A4; margin: 0; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  )
}
