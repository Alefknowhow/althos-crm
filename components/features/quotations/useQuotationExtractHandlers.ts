import { toast } from 'sonner'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import type { ExtractedFlightLeg } from '@/lib/ai/flight-ocr-extract'
import type { ExtractedCruise } from '@/lib/ai/cruise-ocr-extract'
import { nk, hasHtml } from './QuotationEditorFields'
import type {
  Lodging, Flight, Cruise, Transfer, Insurance, Tour, Rental,
} from './QuotationEditorTypes'

const PAYMENT_FORM_LABEL: Record<string, string> = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' }

/**
 * Handlers de "Ler com IA" (autopreenchimento de documento + OCR de voo/
 * cruzeiro) — extraídos do hook principal de estado só pra reduzir o
 * tamanho do arquivo, sem mudança de comportamento. Recebe os setters de
 * estado necessários e devolve os 3 handlers usados pelos diálogos de IA.
 */
export function useQuotationExtractHandlers({
  setQ, setLodgings, setFlights, setCruises, setTransfers, setInsurances, setTours, setRentals,
}: {
  setQ: (fn: (s: any) => any) => void
  setLodgings: (fn: (ls: Lodging[]) => Lodging[]) => void
  setFlights: (fn: (fs: Flight[]) => Flight[]) => void
  setCruises: (fn: (cs: Cruise[]) => Cruise[]) => void
  setTransfers: (fn: (ts: Transfer[]) => Transfer[]) => void
  setInsurances: (fn: (ins: Insurance[]) => Insurance[]) => void
  setTours: (fn: (ts: Tour[]) => Tour[]) => void
  setRentals: (fn: (rs: Rental[]) => Rental[]) => void
}) {
  // "Ler com IA" no bloco Cruzeiro — cria um cruzeiro novo com os campos
  // preenchidos (append, igual ao OCR de voo — nunca sobrescreve o que já
  // existe na lista).
  function handleCruiseExtracted(data: ExtractedCruise) {
    setCruises(cs => [...cs, {
      _key: nk(),
      cruise_line: data.cruise_line, ship_name: data.ship_name, itinerary_name: data.itinerary_name,
      embark_date: data.embark_date, disembark_date: data.disembark_date, duration_nights: data.duration_nights,
      embark_port: data.embark_port, disembark_port: data.disembark_port,
      pax_adults: data.pax_adults, pax_children: data.pax_children,
      cabin_category: data.cabin_category, cabin_type: data.cabin_type,
      cabin_price_cents: data.cabin_price_cents, taxes_cents: data.taxes_cents, total_cents: data.total_cents,
      pkg_drinks: data.pkg_drinks, pkg_internet: data.pkg_internet, pkg_restaurants: data.pkg_restaurants, pkg_gratuities: data.pkg_gratuities,
      days: (data.days.map(d => ({ _key: nk(), day_number: d.day_number, date: d.date, port: d.port, arrival: d.arrival, departure: d.departure }))) as any,
    }])
    toast.success('Cruzeiro adicionado — revise antes de salvar')
  }

  // "Ler com IA" no bloco Aéreo — cada trecho identificado vira uma nova
  // linha em "Trecho" (append, nunca substitui o que já existe na lista).
  function handleFlightLegsExtracted(legs: ExtractedFlightLeg[]) {
    setFlights(fs => [
      ...fs,
      ...legs.map(leg => ({
        _key: nk(),
        leg_type: leg.leg_type || (fs.length === 0 ? 'outbound' : 'inbound'),
        from_code: leg.from_code, from_city: leg.from_city,
        to_code: leg.to_code, to_city: leg.to_city,
        airline: leg.airline, flight_number: leg.flight_number,
        date: leg.departure_date, departure_time: leg.departure_time,
        arrival_date: leg.arrival_date, arrival_time: leg.arrival_time,
        duration_label: leg.duration_label, stopover_label: leg.stopover_label,
        baggage: leg.baggage, cabin_class: leg.cabin_class,
      })) as any,
    ])
    toast.success(`${legs.length} trecho${legs.length === 1 ? '' : 's'} adicionado${legs.length === 1 ? '' : 's'} — revise antes de salvar`)
  }

  // Autopreenchimento com IA — lê um orçamento/voucher (PDF ou imagem) e
  // preenche TODOS os produtos identificados (hospedagem, voo, cruzeiro,
  // transfer, seguro, passeio, locação), valores e políticas. Nunca
  // sobrescreve produtos que já existem na cotação (append-only, como o
  // "Ler com IA" de cada bloco) — só os campos do topo (cliente/datas/
  // total/políticas) são preenchidos se ainda estiverem vazios. Não
  // sobrescreve o nome do cliente quando já há um contato vinculado.
  function handleExtracted(data: ExtractedTravelDocument) {
    setQ((s: any) => ({
      ...s,
      client_name: s.contato_id ? s.client_name : (data.cliente || s.client_name),
      destinations: data.destino && !s.destinations.some((d: any) => d.name)
        ? [{ name: data.destino, country: '' }]
        : s.destinations,
      start_date: data.data_ida || s.start_date,
      end_date: data.data_volta || s.end_date,
      operadora: data.operadora || s.operadora,
      total_cents: data.valor_total_cents || s.total_cents,
      important_html: hasHtml(s.important_html) ? s.important_html : (data.informacoes_importantes ? `<p>${data.informacoes_importantes}</p>` : s.important_html),
      cancellation_html: hasHtml(s.cancellation_html) ? s.cancellation_html : (data.politica_cancelamento ? `<p>${data.politica_cancelamento}</p>` : s.cancellation_html),
      payment_conditions: data.condicoes_pagamento.reduce((acc: any[], c: any) => {
        if (!c.forma) return acc
        const label = PAYMENT_FORM_LABEL[c.forma]
        if (acc.some(p => p.label === label)) return acc
        return [...acc, { label, value: c.condicao || '' }]
      }, s.payment_conditions),
    }))

    if (data.hospedagens.length > 0) {
      setLodgings(ls => [...ls, ...data.hospedagens.map(h => ({
        _key: nk(), name: h.nome || '', photos: [] as string[],
        check_in: h.check_in, check_out: h.check_out, check_in_time: '15:00', check_out_time: '12:00',
        room_category: h.categoria_quarto, board: h.regime,
      })) as any])
    }
    if (data.voos.length > 0) {
      setFlights(fs => [...fs, ...data.voos.map((v, i) => ({
        _key: nk(),
        leg_type: v.sentido === 'volta' ? 'inbound' as const : v.sentido === 'ida' ? 'outbound' as const : (i === 0 ? 'outbound' as const : 'inbound' as const),
        airline: v.companhia || undefined,
        date: v.data || undefined,
        from_city: v.origem || undefined,
        to_city: v.destino || undefined,
        baggage: [] as string[],
      })) as any])
    }
    if (data.cruzeiros.length > 0) {
      setCruises(cs => [...cs, ...data.cruzeiros.map(c => ({
        _key: nk(), cruise_line: c.companhia, ship_name: c.navio, itinerary_name: c.roteiro,
        embark_port: c.embarque_porto, embark_date: c.embarque_data,
        disembark_port: c.desembarque_porto, disembark_date: c.desembarque_data,
        duration_nights: c.noites, cabin_category: c.cabine, days: [] as any[],
      })) as any])
    }
    if (data.transfers.length > 0) {
      setTransfers(ts => [...ts, ...data.transfers.map(t => ({
        _key: nk(), origin: t.origem, destination: t.destino, date: t.data, time: t.horario,
        vehicle: t.veiculo, transfer_type: t.tipo,
      })) as any])
    }
    if (data.seguros.length > 0) {
      setInsurances(ins => [...ins, ...data.seguros.map(sg => ({
        _key: nk(), insurer: sg.seguradora, plan: sg.plano, destination: sg.destino,
        coverage: sg.cobertura, date_start: sg.data_inicio, date_end: sg.data_fim,
      })) as any])
    }
    if (data.passeios.length > 0) {
      setTours(ts => [...ts, ...data.passeios.map(p => ({
        _key: nk(), name: p.nome, description: p.descricao, date: p.data, duration_label: p.duracao,
      })) as any])
    }
    if (data.locacoes.length > 0) {
      setRentals(rs => [...rs, ...data.locacoes.map(l => ({
        _key: nk(), company: l.locadora, vehicle_category: l.categoria_veiculo,
        pickup_location: l.retirada_local, dropoff_location: l.devolucao_local,
        pickup_date: l.retirada_data, dropoff_date: l.devolucao_data,
      })) as any])
    }

    const productCount = data.hospedagens.length + data.voos.length + data.cruzeiros.length
      + data.transfers.length + data.seguros.length + data.passeios.length + data.locacoes.length
    toast.success(productCount > 0
      ? `${productCount} produto${productCount === 1 ? '' : 's'} adicionado${productCount === 1 ? '' : 's'} — revise antes de salvar`
      : 'Campos preenchidos a partir do documento. Revise antes de salvar.')
  }

  return { handleCruiseExtracted, handleFlightLegsExtracted, handleExtracted }
}
