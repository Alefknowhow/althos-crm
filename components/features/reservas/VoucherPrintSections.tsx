'use client'

/**
 * Per-service sections (Voos, Hospedagem, Traslados, Cruzeiro, Passeios,
 * Serviços, Seguro) rendered by VoucherPrintView. Split out of
 * VoucherPrintView.tsx — each section only renders when its `has*` flag
 * (computed by the caller) is true.
 */

import { Plane, Hotel, Car, ShieldCheck, Compass, Ticket, Ship } from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'
import {
  fmtDate, firstWord, SectionBar, BaggageRow, InfoRow,
  type VooLeg, type VooProduct, type HospedagemProduct, type GenericProduct,
} from './VoucherPrintHelpers'

export function FlightsSection({ sale, accent, voos }: { sale: TravelSaleRow; accent: string; voos: VooProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Plane} title="Voos" accent={accent} />
      {sale.air_locator && voos.length === 0 && (
        <div className="px-3 pt-3">
          <InfoRow label="Localizador (PNR)" value={sale.air_locator} mono />
        </div>
      )}
      {voos.length > 0 ? (
        <div className="divide-y">
          {voos.map(v => {
            const legs = v.data.legs && v.data.legs.length > 0 ? v.data.legs : [v.data as VooLeg]
            // Check-in/bilhete/bagagem valem pro bilhete inteiro (mesmo
            // valor repetido em cada trecho pelo OCR) — mostra uma vez
            // só, no cabeçalho do grupo (ida/volta) e no rodapé.
            const checkin = legs.find(l => l.localizador_checkin)?.localizador_checkin || v.data.localizador
            const bilhete = legs.find(l => l.bilhete)?.bilhete
            const bagagem = legs.find(l => l.bagagem)?.bagagem
            return (
              <div key={v.id} className="p-3 break-inside-avoid">
                <div className="flex items-center justify-between mb-2 flex-wrap gap-x-4 gap-y-1">
                  <p className="text-[10px] uppercase tracking-wide font-bold" style={{ color: accent }}>{v.data.sentido || '—'}</p>
                  <div className="flex items-center gap-4">
                    {checkin && <p className="text-[11px] font-mono text-gray-500">Check-in: {checkin}</p>}
                    {bilhete && <p className="text-[11px] font-mono text-gray-500">Bilhete: {bilhete}</p>}
                  </div>
                </div>
                <div className="space-y-2.5">
                  {legs.map((leg, i) => (
                    <div key={i} className="break-inside-avoid">
                      {leg.escala_local && (
                        <p className="text-[10px] text-gray-400 italic mb-1.5 text-center">
                          Conexão em {leg.escala_local}{leg.escala_duracao ? ` · espera de ${leg.escala_duracao}` : ''}
                        </p>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <InfoRow label="Companhia / voo" value={[firstWord(leg.companhia), leg.numero].filter(Boolean).join(' · ') || '—'} />
                        <InfoRow label="Origem" value={leg.origem && (leg.hora_embarque || leg.data) ? <>{leg.origem} <span className="text-gray-400">· {fmtDate(leg.data)}{leg.hora_embarque ? ` ${leg.hora_embarque}` : ''}</span></> : leg.origem} />
                        <InfoRow label="Destino" value={leg.destino && (leg.hora_chegada || leg.data_chegada) ? <>{leg.destino} <span className="text-gray-400">· {leg.data_chegada ? `${fmtDate(leg.data_chegada)} ` : ''}{leg.hora_chegada || ''}</span></> : leg.destino} />
                        <InfoRow label="Duração" value={leg.duracao} />
                      </div>
                    </div>
                  ))}
                </div>
                {bagagem && <BaggageRow text={bagagem} />}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 p-3">
          <InfoRow label="Companhia aérea" value={sale.airline} />
          <InfoRow label="Data de ida" value={fmtDate(sale.departure_date)} />
          <InfoRow label="Data de volta" value={fmtDate(sale.return_date)} />
        </div>
      )}
    </div>
  )
}

export function HotelSection({ sale, accent, hospedagens }: { sale: TravelSaleRow; accent: string; hospedagens: HospedagemProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Hotel} title="Hospedagem" accent={accent} />
      {hospedagens.length > 0 ? (
        <div className="divide-y">
          {hospedagens.map(h => {
            const d = h.data
            const diarias = d.check_in && d.check_out
              ? Math.round((new Date(`${d.check_out}T12:00:00`).getTime() - new Date(`${d.check_in}T12:00:00`).getTime()) / 86400000)
              : null
            return (
              <div key={h.id} className="p-3 break-inside-avoid">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">{d.hotel || '—'}</p>
                  {d.localizador && <p className="text-[11px] font-mono text-gray-500">Localizador: {d.localizador}</p>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <InfoRow label="Check-in" value={d.check_in ? <>{fmtDate(d.check_in)}{d.hora_checkin ? ` · ${d.hora_checkin}` : ''}</> : '—'} />
                  <InfoRow label="Check-out" value={d.check_out ? <>{fmtDate(d.check_out)}{d.hora_checkout ? ` · ${d.hora_checkout}` : ''}</> : '—'} />
                  <InfoRow label="Diárias" value={diarias && diarias > 0 ? `${diarias} diária${diarias > 1 ? 's' : ''}` : '—'} />
                  <InfoRow label="Titular" value={d.titular || sale.client_name} />
                </div>
                {(d.tipo_quarto || d.regime) && (
                  <div className="grid grid-cols-2 gap-3 mt-1.5">
                    <InfoRow label="Tipo de quarto" value={d.tipo_quarto} />
                    <InfoRow label="Regime" value={d.regime} />
                  </div>
                )}
                {(d.endereco || d.email || d.telefone) && (
                  <div className="grid grid-cols-3 gap-3 mt-1.5">
                    <InfoRow label="Endereço" value={d.endereco} />
                    <InfoRow label="E-mail" value={d.email} />
                    <InfoRow label="Telefone" value={d.telefone} />
                  </div>
                )}
                {(d.informacoes_adicionais || d.politica_cancelamento || d.condicoes) && (
                  <div className="mt-2 pt-2 border-t space-y-1">
                    {d.informacoes_adicionais && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Informações adicionais:</span> {d.informacoes_adicionais}</p>}
                    {d.politica_cancelamento && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Política de cancelamento:</span> {d.politica_cancelamento}</p>}
                    {d.condicoes && <p className="text-[9px] text-gray-500 leading-snug"><span className="font-semibold">Condições da reserva:</span> {d.condicoes}</p>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <>
          {sale.hotel_locator && (
            <div className="px-3 pt-3">
              <InfoRow label="Localizador" value={sale.hotel_locator} mono />
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 p-3">
            <InfoRow label="Hotel" value={sale.hotel_name} />
            <InfoRow label="Localização" value={sale.destination} />
            <InfoRow label="Check-in" value={fmtDate(sale.departure_date)} />
            <InfoRow label="Check-out" value={fmtDate(sale.return_date)} />
          </div>
        </>
      )}
    </div>
  )
}

export function TransfersSection({ sale, accent, transfers }: { sale: TravelSaleRow; accent: string; transfers: GenericProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Car} title="Traslados" accent={accent} />
      {transfers.length > 0 ? (
        <div className="divide-y">
          {transfers.map(t => (
            <div key={t.id} className="p-3 break-inside-avoid">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold">{[t.data.origem, t.data.destino].filter(Boolean).join(' → ') || t.data.tipo_servico || 'Transfer'}</p>
                {t.data.codigo_reserva && <p className="text-[11px] font-mono text-gray-500">Código: {t.data.codigo_reserva}</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <InfoRow label="Titular" value={t.data.titular || sale.client_name} />
                <InfoRow label="Data" value={t.data.data ? fmtDate(t.data.data) : '—'} />
                <InfoRow label="Horário" value={t.data.horario} />
                <InfoRow label="Tipo" value={t.data.tipo_servico} />
              </div>
              {(t.data.fornecedor || t.data.contato) && (
                <div className="grid grid-cols-2 gap-3 mt-1.5">
                  <InfoRow label="Empresa/motorista" value={t.data.fornecedor} />
                  <InfoRow label="Contato" value={t.data.contato} />
                </div>
              )}
              {t.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{t.data.observacoes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-sm text-gray-600">Traslado incluso no pacote — chegada e saída conforme itinerário combinado.</div>
      )}
    </div>
  )
}

export function CruiseSection({ sale, accent, cruzeiros }: { sale: TravelSaleRow; accent: string; cruzeiros: GenericProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Ship} title="Cruzeiro" accent={accent} />
      <div className="divide-y">
        {cruzeiros.map(c => (
          <div key={c.id} className="p-3 break-inside-avoid">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-sm font-semibold">{c.data.navio || c.data.companhia || 'Cruzeiro'}</p>
              {c.data.localizador && <p className="text-[11px] font-mono text-gray-500">Localizador: {c.data.localizador}</p>}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <InfoRow label="Titular" value={c.data.titular || sale.client_name} />
              <InfoRow label="Roteiro" value={c.data.roteiro} />
              <InfoRow label="Embarque" value={c.data.embarque_data ? <>{fmtDate(c.data.embarque_data)}{c.data.embarque_porto ? ` · ${c.data.embarque_porto}` : ''}</> : '—'} />
              <InfoRow label="Desembarque" value={c.data.desembarque_data ? <>{fmtDate(c.data.desembarque_data)}{c.data.desembarque_porto ? ` · ${c.data.desembarque_porto}` : ''}</> : '—'} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-1.5">
              <InfoRow label="Cabine" value={c.data.cabine} />
              <InfoRow label="Categoria" value={c.data.categoria} />
              <InfoRow label="Deck" value={c.data.deck} />
              <InfoRow label="Vista" value={c.data.vista} />
            </div>
            {(c.data.localizacao || c.data.regime) && (
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <InfoRow label="Localização" value={c.data.localizacao} />
                <InfoRow label="Plano de alimentação" value={c.data.regime} />
              </div>
            )}
            {c.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{c.data.observacoes}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function ToursSection({ sale, accent, ingressos }: { sale: TravelSaleRow; accent: string; ingressos: GenericProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Compass} title="Passeios e ingressos" accent={accent} />
      {ingressos.length > 0 ? (
        <div className="divide-y">
          {ingressos.map(p => (
            <div key={p.id} className="p-3 break-inside-avoid">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-sm font-semibold">{p.data.atracao || p.data.nome || 'Passeio/Ingresso'}</p>
                {p.data.codigo_reserva && <p className="text-[11px] font-mono text-gray-500">Código: {p.data.codigo_reserva}</p>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoRow label="Titular" value={p.data.titular || sale.client_name} />
                <InfoRow label="Data" value={p.data.data ? fmtDate(p.data.data) : '—'} />
                <InfoRow label="Prestador de serviço" value={p.data.fornecedor} />
              </div>
              {p.data.contato && <div className="mt-1.5"><InfoRow label="Contato" value={p.data.contato} /></div>}
              {p.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{p.data.observacoes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-sm text-gray-600">Passeios inclusos no pacote — consulte roteiro e horários com o guia local.</div>
      )}
    </div>
  )
}

export function ServicesSection({ accent, all }: { accent: string; all: string[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={Ticket} title="Serviços" accent={accent} />
      <div className="flex gap-1.5 flex-wrap p-3">
        {(all.includes('carros') || all.includes('car_rental')) && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Locação de carro</span>}
        {all.includes('servicos') && <span className="text-xs px-2 py-1 rounded-full bg-gray-100">Serviços diversos</span>}
      </div>
    </div>
  )
}

export function InsuranceSection({ sale, accent, seguros }: { sale: TravelSaleRow; accent: string; seguros: GenericProduct[] }) {
  return (
    <div className="border rounded-md overflow-hidden break-inside-avoid">
      <SectionBar icon={ShieldCheck} title="Seguro viagem" accent={accent} />
      {seguros.length > 0 ? (
        <div className="divide-y">
          {seguros.map(s => (
            <div key={s.id} className="p-3 break-inside-avoid">
              <p className="text-sm font-semibold mb-1.5">{s.data.nome || 'Seguro viagem'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <InfoRow label="Titular" value={s.data.titular || sale.client_name} />
                <InfoRow label="Vigência a partir de" value={s.data.data ? fmtDate(s.data.data) : '—'} />
                <InfoRow label="Apólice" value={s.data.localizador} />
              </div>
              {s.data.observacoes && <p className="text-[9px] text-gray-500 leading-snug mt-2 pt-2 border-t">{s.data.observacoes}</p>}
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 text-sm text-gray-600">Seguro viagem incluso — mantenha este voucher e o cartão do seguro em mãos durante a viagem.</div>
      )}
    </div>
  )
}
