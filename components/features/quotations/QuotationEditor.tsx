'use client'

/**
 * Editor da Cotação — formulário em largura total (1:1 com a entrega).
 * Use o botão "Abrir" pra ver a proposta pública real em nova aba.
 *
 * Autosave com debounce (~800ms). Repeaters reordenáveis via dnd-kit.
 * Imagens: upload/colar/arrastar com compressão client-side.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cityFromAirportCode } from '@/lib/airports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Plus, Trash2, Loader2, Copy, ExternalLink,
  CheckCircle2, Link2, Image as ImageIcon,
  MapPin, Route, AlertTriangle,
  Sparkles, FileText, Map as MapIcon, LocateFixed,
} from 'lucide-react'

import {
  saveQuotation, generateQuotationLink, tripadvisorLookup, convertOfferToQuotation, type QuotationFull,
  listFooterProfiles, createFooterProfile, deleteFooterProfile, type FooterProfileRow,
} from '@/actions/quotations'
import { geocodePlace } from '@/actions/travel-proposals'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import DocumentExtractDialog from '@/components/features/ai/DocumentExtractDialog'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import FlightOcrDialog from './FlightOcrDialog'
import type { ExtractedFlightLeg } from '@/lib/ai/flight-ocr-extract'
import CruiseOcrDialog from './CruiseOcrDialog'
import type { ExtractedCruise } from '@/lib/ai/cruise-ocr-extract'
import {
  PAYMENT_METHODS, INCLUDED_SUGGESTIONS, NOT_INCLUDED_SUGGESTIONS,
  nk, withKeys, computeFlightDuration, hasHtml,
  ToggleRichField, CoverUpload,
  F, EditBlock, type GroupId, GroupNavMobile, GroupNavSidebar, GroupSection,
  StringList,
} from './QuotationEditorFields'

/* ═════════════ estado do editor ═════════════ */
import type {
  Lodging, Flight, Pin, Cruise, Transfer, Insurance, Tour, Rental,
} from './QuotationEditorTypes'
import QuotationEditorProductsGroup from './QuotationEditorProductsGroup'
import QuotationEditorInvestimentoGroup from './QuotationEditorInvestimentoGroup'
import QuotationEditorFechamentoGroup from './QuotationEditorFechamentoGroup'

export default function QuotationEditor({ orgSlug, initial, leads = [], isOffer = false }: {
  orgSlug: string; initial: QuotationFull; leads?: { id: string; name: string; phone?: string | null }[]; isOffer?: boolean
}) {
  const router = useRouter()
  const q0 = initial.quotation

  const [q, setQ] = useState(() => ({
    title: q0.title || '', subtitle: q0.subtitle || '',
    status: (q0.status || 'draft') as string,
    contato_id: (q0.contato_id || null) as string | null,
    client_name: q0.client_name || '', client_whatsapp: q0.client_whatsapp || '',
    cover_image_url: q0.cover_image_url || null as string | null,
    origin_label: q0.origin_label || '', origin_note: q0.origin_note || '',
    destinations: (Array.isArray(q0.destinations) ? q0.destinations : []).map((x: any) => ({ name: x?.name || '', country: x?.country || '' })),
    start_date: q0.start_date || '', end_date: q0.end_date || '',
    pax_adults: q0.pax_adults || 0, pax_children: q0.pax_children || 0,
    children_ages: (q0.children_ages || []) as number[],
    occupancy_label: q0.occupancy_label || '',
    intro_html: q0.intro_html || '', important_html: q0.important_html || '', closing_html: q0.closing_html || '',
    cancellation_html: q0.cancellation_html || '',
    itinerary_html: q0.itinerary_html || '',
    flights_html: (q0 as any).flights_html || '',
    flight_fare_conditions: ((q0 as any).flight_fare_conditions || []) as string[],
    tours_html: (q0 as any).tours_html || '',
    included: (q0.included || []) as string[], not_included: (q0.not_included || []) as string[],
    price_per_person_cents: (q0.price_per_person_cents ?? null) as number | null,
    total_cents: (q0.total_cents || 0) as number,
    payment_conditions: (Array.isArray(q0.payment_conditions) ? q0.payment_conditions : [])
      .map((x: any) => {
        // Normaliza labels antigos para os 3 métodos fixos (Pix/Cartão/Boleto).
        const raw = (x?.label || '').toLowerCase()
        const label = raw.includes('pix') ? 'Pix'
          : raw.includes('cart') ? 'Cartão de crédito'
          : raw.includes('boleto') ? 'Boleto'
          : (x?.label || '')
        return { label, value: x?.value || '' }
      })
      // O editor só suporta esses 3 métodos fixos — qualquer label antigo
      // que não bateu na normalização acima (ex.: "À vista") é lixo de uma
      // versão anterior da tela e é descartado aqui, senão fica preso pra
      // sempre no dado (a UI não tem como editá-lo/removê-lo).
      .filter((x: any) => PAYMENT_METHODS.some(m => m.label === x.label))
      // Descarta duplicatas do mesmo método, mantendo a primeira.
      .filter((x: any, i: number, arr: any[]) => arr.findIndex(y => y.label === x.label) === i),
    price_disclaimer: q0.price_disclaimer || '',
    validity_days: q0.validity_days || 5,
    operadora: q0.operadora || '', commission_total_cents: q0.commission_total_cents || 0,
    offer_published: !!q0.offer_published, offer_category: q0.offer_category || '',
    signature_enabled: !!(q0 as any).signature_enabled,
    signature_name: (q0 as any).signature_name || '',
    signature_photo_url: ((q0 as any).signature_photo_url || null) as string | null,
    signature_message: (q0 as any).signature_message || '',
    signature_bg_color: (q0 as any).signature_bg_color || '#0f172a',
    signature_text_color: (q0 as any).signature_text_color || '#ffffff',
    footer_override: !!(q0 as any).footer_override,
    footer_legal_name: (q0 as any).footer_legal_name || '',
    footer_logo_url: ((q0 as any).footer_logo_url || null) as string | null,
    footer_address: (q0 as any).footer_address || '',
    footer_cnpj: (q0 as any).footer_cnpj || '',
    footer_cadastur: (q0 as any).footer_cadastur || '',
    footer_instagram_url: (q0 as any).footer_instagram_url || '',
    footer_site_url: (q0 as any).footer_site_url || '',
    footer_whatsapp_number: (q0 as any).footer_whatsapp_number || '',
    footer_phone: (q0 as any).footer_phone || '',
    footer_email: (q0 as any).footer_email || '',
  }))
  // Aéreo/Hospedagem vivem em quotation_products (Construtor de Viagens,
  // infra única compartilhada por todo tipo de produto) — filtra por
  // product_type e achata `data` de volta pro shape local que o resto
  // deste arquivo (ainda) espera. `_productId` guarda o id da linha em
  // quotation_products só quando o produto já existe (undefined = novo).
  const initialProducts = (initial.products || []) as any[]
  const [lodgings, setLodgings] = useState<Lodging[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'hospedagem').map(p => {
    const l = p.data || {}
    return {
      name: p.name || '', check_in: l.check_in, check_out: l.check_out,
      check_in_time: l.check_in_time ?? '15:00', check_out_time: l.check_out_time ?? '12:00',
      room_category: l.room_category, star_rating: l.star_rating ?? null,
      board: l.board, description_html: l.description_html, photos: (l.photos || []) as string[],
      lat: l.lat, lng: l.lng, tripadvisor_location_id: l.tripadvisor_location_id, tripadvisor_data: l.tripadvisor_data,
      is_alternative_option: !!l.is_alternative_option,
      option_price_per_person_cents: l.option_price_per_person_cents ?? null,
      option_total_cents: l.option_total_cents ?? null,
    }
  })) as Lodging[])
  const [flights, setFlights] = useState<Flight[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'aereo').map(p => {
    const f = p.data || {}
    return {
      leg_type: f.leg_type || 'outbound', from_code: f.from_code, from_city: cityFromAirportCode(f.from_code) || f.from_city,
      to_code: f.to_code, to_city: cityFromAirportCode(f.to_code) || f.to_city, airline: f.airline, flight_number: f.flight_number,
      date: f.date, departure_time: f.departure_time,
      arrival_date: f.arrival_date, arrival_time: f.arrival_time,
      duration_label: f.duration_label, stopover_label: f.stopover_label,
      baggage: (f.baggage || []) as string[], cabin_class: f.cabin_class || null,
    }
  })) as Flight[])
  const [pins, setPins] = useState<Pin[]>(() => withKeys(initial.map_pins.map(p => ({
    label: p.label || '', type: p.type || 'attraction', lat: p.lat, lng: p.lng,
  }))) as Pin[])
  const [cruises, setCruises] = useState<Cruise[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'cruzeiro').map(p => {
    const c = p.data || {}
    const iv = p.internal_data || {}
    return {
      ...c,
      total_cents: p.price_cents ?? c.total_cents ?? null,
      days: withKeys((c.days || []) as any[]),
      cabin_options: withKeys((c.cabin_options || []) as any[]),
      supplier: iv.supplier ?? null, fare_code: iv.fare_code ?? null, cost_cents: iv.cost_cents ?? null, internal_notes: iv.internal_notes ?? null,
    }
  })) as Cruise[])
  const [transfers, setTransfers] = useState<Transfer[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'transfer').map(p => ({ ...(p.data || {}), date: p.data?.date ?? p.date_start ?? null }))) as Transfer[])
  const [insurances, setInsurances] = useState<Insurance[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'seguro').map(p => ({ ...(p.data || {}), date_start: p.data?.date_start ?? p.date_start ?? null, date_end: p.data?.date_end ?? p.date_end ?? null }))) as Insurance[])
  const [tours, setTours] = useState<Tour[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'passeio').map(p => ({ ...(p.data || {}), name: p.name ?? p.data?.name ?? null, date: p.data?.date ?? p.date_start ?? null }))) as Tour[])
  const [rentals, setRentals] = useState<Rental[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'locacao').map(p => ({ ...(p.data || {}), pickup_date: p.data?.pickup_date ?? p.date_start ?? null, dropoff_date: p.data?.dropoff_date ?? p.date_end ?? null }))) as Rental[])

  const [publicToken, setPublicToken] = useState<string | null>(q0.public_token || null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [taBusy, setTaBusy] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState<string | null>(null)
  const [saleBusy, setSaleBusy] = useState(false)
  const [extractOpen, setExtractOpen] = useState(false)
  const [flightOcrOpen, setFlightOcrOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<GroupId>('resumo')
  const [flightsTextOpen, setFlightsTextOpen] = useState(() => !!initial.quotation.flights_html?.trim())
  const [cruiseOcrOpen, setCruiseOcrOpen] = useState(false)

  // Marcas salvas de rodapé/identidade (2ª agência) — evita redigitar os
  // mesmos dados toda vez que uma cotação usa uma marca diferente.
  const [footerProfiles, setFooterProfiles] = useState<FooterProfileRow[]>([])
  const [footerProfileBusy, setFooterProfileBusy] = useState(false)
  useEffect(() => { listFooterProfiles(orgSlug).then(setFooterProfiles) }, [orgSlug])

  function applyFooterProfile(p: FooterProfileRow) {
    setQ(s => ({
      ...s,
      footer_override: true,
      footer_legal_name: p.legal_name || '',
      footer_logo_url: p.logo_url,
      footer_address: p.address || '',
      footer_cnpj: p.cnpj || '',
      footer_cadastur: p.cadastur || '',
      footer_instagram_url: p.instagram_url || '',
      footer_site_url: p.site_url || '',
      footer_whatsapp_number: p.whatsapp_number || '',
      footer_phone: p.phone || '',
      footer_email: p.email || '',
    }))
  }

  async function saveFooterProfile() {
    const name = window.prompt('Nome para salvar esta marca (ex.: nome da outra agência):')?.trim()
    if (!name) return
    setFooterProfileBusy(true)
    const res = await createFooterProfile(orgSlug, {
      name,
      legal_name: q.footer_legal_name || null,
      logo_url: q.footer_logo_url,
      address: q.footer_address || null,
      cnpj: q.footer_cnpj || null,
      cadastur: q.footer_cadastur || null,
      instagram_url: q.footer_instagram_url || null,
      site_url: q.footer_site_url || null,
      whatsapp_number: q.footer_whatsapp_number || null,
      phone: q.footer_phone || null,
      email: q.footer_email || null,
    })
    setFooterProfileBusy(false)
    if (res.ok) { toast.success('Marca salva'); listFooterProfiles(orgSlug).then(setFooterProfiles) }
    else toast.error(res.error)
  }

  async function removeFooterProfile(id: string) {
    const res = await deleteFooterProfile(orgSlug, id)
    if (res.ok) setFooterProfiles(ps => ps.filter(p => p.id !== id))
    else toast.error(res.error)
  }

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
      days: withKeys(data.days.map(d => ({ day_number: d.day_number, date: d.date, port: d.port, arrival: d.arrival, departure: d.departure }))),
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
      })),
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
  const PAYMENT_FORM_LABEL: Record<string, string> = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' }

  function handleExtracted(data: ExtractedTravelDocument) {
    setQ(s => ({
      ...s,
      client_name: s.contato_id ? s.client_name : (data.cliente || s.client_name),
      destinations: data.destino && !s.destinations.some(d => d.name)
        ? [{ name: data.destino, country: '' }]
        : s.destinations,
      start_date: data.data_ida || s.start_date,
      end_date: data.data_volta || s.end_date,
      operadora: data.operadora || s.operadora,
      total_cents: data.valor_total_cents || s.total_cents,
      important_html: hasHtml(s.important_html) ? s.important_html : (data.informacoes_importantes ? `<p>${data.informacoes_importantes}</p>` : s.important_html),
      cancellation_html: hasHtml(s.cancellation_html) ? s.cancellation_html : (data.politica_cancelamento ? `<p>${data.politica_cancelamento}</p>` : s.cancellation_html),
      payment_conditions: data.condicoes_pagamento.reduce((acc, c) => {
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
      }))])
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
      }))])
    }
    if (data.cruzeiros.length > 0) {
      setCruises(cs => [...cs, ...data.cruzeiros.map(c => ({
        _key: nk(), cruise_line: c.companhia, ship_name: c.navio, itinerary_name: c.roteiro,
        embark_port: c.embarque_porto, embark_date: c.embarque_data,
        disembark_port: c.desembarque_porto, disembark_date: c.desembarque_data,
        duration_nights: c.noites, cabin_category: c.cabine, days: [] as any[],
      }))])
    }
    if (data.transfers.length > 0) {
      setTransfers(ts => [...ts, ...data.transfers.map(t => ({
        _key: nk(), origin: t.origem, destination: t.destino, date: t.data, time: t.horario,
        vehicle: t.veiculo, transfer_type: t.tipo,
      }))])
    }
    if (data.seguros.length > 0) {
      setInsurances(ins => [...ins, ...data.seguros.map(sg => ({
        _key: nk(), insurer: sg.seguradora, plan: sg.plano, destination: sg.destino,
        coverage: sg.cobertura, date_start: sg.data_inicio, date_end: sg.data_fim,
      }))])
    }
    if (data.passeios.length > 0) {
      setTours(ts => [...ts, ...data.passeios.map(p => ({
        _key: nk(), name: p.nome, description: p.descricao, date: p.data, duration_label: p.duracao,
      }))])
    }
    if (data.locacoes.length > 0) {
      setRentals(rs => [...rs, ...data.locacoes.map(l => ({
        _key: nk(), company: l.locadora, vehicle_category: l.categoria_veiculo,
        pickup_location: l.retirada_local, dropoff_location: l.devolucao_local,
        pickup_date: l.retirada_data, dropoff_date: l.devolucao_data,
      }))])
    }

    const productCount = data.hospedagens.length + data.voos.length + data.cruzeiros.length
      + data.transfers.length + data.seguros.length + data.passeios.length + data.locacoes.length
    toast.success(productCount > 0
      ? `${productCount} produto${productCount === 1 ? '' : 's'} adicionado${productCount === 1 ? '' : 's'} — revise antes de salvar`
      : 'Campos preenchidos a partir do documento. Revise antes de salvar.')
  }

  const paxTotal = (q.pax_adults || 0) + (q.pax_children || 0)

  // valor por pessoa automático = total ÷ pax (o total é sempre o campo editável)
  useEffect(() => {
    const auto = paxTotal > 0 ? Math.round((q.total_cents || 0) / paxTotal) : null
    if (auto !== q.price_per_person_cents) {
      setQ(s => ({ ...s, price_per_person_cents: auto }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.total_cents, paxTotal])

  // Datas da viagem são a fonte única — check-in/check-out de hospedagem e as
  // datas de voo (ida/volta) seguem a data da viagem automaticamente. Só não
  // mexe se o campo já tiver sido customizado pra uma data diferente da viagem
  // (ex.: check-in um dia antes do voo de ida).
  const prevTripDates = useRef({ start: q.start_date, end: q.end_date })
  useEffect(() => {
    const prev = prevTripDates.current
    if (prev.start !== q.start_date) {
      setLodgings(ls => ls.map(l => (!l.check_in || l.check_in === prev.start) ? { ...l, check_in: q.start_date || null } : l))
      setFlights(fs => fs.map(f => f.leg_type === 'outbound' && (!f.date || f.date === prev.start) ? { ...f, date: q.start_date || undefined } : f))
    }
    if (prev.end !== q.end_date) {
      setLodgings(ls => ls.map(l => (!l.check_out || l.check_out === prev.end) ? { ...l, check_out: q.end_date || null } : l))
      setFlights(fs => fs.map(f => f.leg_type === 'inbound' && (!f.date || f.date === prev.end) ? { ...f, date: q.end_date || undefined } : f))
    }
    prevTripDates.current = { start: q.start_date, end: q.end_date }
  }, [q.start_date, q.end_date])

  /* ─────── payload + autosave ─────── */
  const payload = useMemo(() => ({
    title: q.title || null, subtitle: q.subtitle || null, status: q.status as any,
    contato_id: q.contato_id,
    client_name: q.client_name || null, client_whatsapp: q.client_whatsapp || null,
    cover_image_url: q.cover_image_url || null,
    origin_label: q.origin_label || null, origin_note: q.origin_note || null,
    destinations: q.destinations.filter(d => d.name),
    start_date: q.start_date || null, end_date: q.end_date || null,
    pax_adults: q.pax_adults, pax_children: q.pax_children, children_ages: q.children_ages,
    occupancy_label: q.occupancy_label || null,
    intro_html: q.intro_html || null, important_html: q.important_html || null, closing_html: q.closing_html || null,
    cancellation_html: q.cancellation_html || null,
    itinerary_html: q.itinerary_html || null,
    flights_html: q.flights_html || null,
    flight_fare_conditions: q.flight_fare_conditions,
    tours_html: q.tours_html || null,
    included: q.included.filter(Boolean), not_included: q.not_included.filter(Boolean),
    price_per_person_cents: q.price_per_person_cents, total_cents: q.total_cents,
    payment_conditions: q.payment_conditions.filter(p => p.label || p.value),
    price_disclaimer: q.price_disclaimer || null, validity_days: q.validity_days,
    operadora: q.operadora || null, commission_total_cents: q.commission_total_cents,
    signature_enabled: q.signature_enabled,
    signature_name: q.signature_name || null,
    signature_photo_url: q.signature_photo_url || null,
    signature_message: q.signature_message || null,
    signature_bg_color: q.signature_bg_color || null,
    signature_text_color: q.signature_text_color || null,
    footer_override: q.footer_override,
    footer_legal_name: q.footer_legal_name || null,
    footer_logo_url: q.footer_logo_url || null,
    footer_address: q.footer_address || null,
    footer_cnpj: q.footer_cnpj || null,
    footer_cadastur: q.footer_cadastur || null,
    footer_instagram_url: q.footer_instagram_url || null,
    footer_site_url: q.footer_site_url || null,
    footer_whatsapp_number: q.footer_whatsapp_number || null,
    footer_phone: q.footer_phone || null,
    footer_email: q.footer_email || null,
    ...(isOffer ? { offer_published: q.offer_published, offer_category: q.offer_category || null } : {}),
    products: [
      ...lodgings.map(({ _key, name, check_in, check_out, ...rest }) => ({
        product_type: 'hospedagem' as const,
        name: name || null,
        date_start: check_in || null, date_end: check_out || null,
        price_cents: rest.option_total_cents ?? null,
        data: { check_in, check_out, ...rest },
        internal_data: {},
      })),
      ...flights.map(({ _key, ...f }) => ({
        product_type: 'aereo' as const,
        name: [f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' → ') || null,
        date_start: f.date || null, date_end: f.arrival_date || f.date || null,
        price_cents: null,
        data: { ...f, duration_label: computeFlightDuration(f) || f.duration_label, baggage: f.baggage as any, cabin_class: (f.cabin_class || null) as any },
        internal_data: {},
      })),
      ...cruises.map(({ _key, days, cabin_options, total_cents, supplier, fare_code, cost_cents, internal_notes, ...c }) => ({
        product_type: 'cruzeiro' as const,
        name: c.ship_name || c.cruise_line || null,
        summary: [c.itinerary_name, c.duration_nights ? `${c.duration_nights} noites` : null].filter(Boolean).join(' · ') || null,
        date_start: c.embark_date || null, date_end: c.disembark_date || null,
        price_cents: total_cents ?? null,
        data: { ...c, total_cents, days: days.map(({ _key: __k, ...d }) => d), cabin_options: (cabin_options || []).map(({ _key: __k, ...o }) => o).filter(o => o.label || o.price_cents) },
        internal_data: { supplier, fare_code, cost_cents, internal_notes },
      })),
      ...transfers.map(({ _key, ...t }) => ({
        product_type: 'transfer' as const,
        name: [t.origin, t.destination].filter(Boolean).join(' → ') || null,
        date_start: t.date || null, date_end: null,
        price_cents: null,
        data: { ...t },
        internal_data: {},
      })),
      ...insurances.map(({ _key, ...s }) => ({
        product_type: 'seguro' as const,
        name: s.insurer || null,
        date_start: s.date_start || null, date_end: s.date_end || null,
        price_cents: null,
        data: { ...s },
        internal_data: {},
      })),
      ...tours.map(({ _key, name, description, ...t }) => ({
        product_type: 'passeio' as const,
        name: name || null,
        summary: description || null,
        date_start: t.date || null, date_end: null,
        price_cents: null,
        data: { name, ...t },
        internal_data: {},
      })),
      ...rentals.map(({ _key, ...r }) => ({
        product_type: 'locacao' as const,
        name: [r.company, r.vehicle_category].filter(Boolean).join(' — ') || null,
        date_start: r.pickup_date || null, date_end: r.dropoff_date || null,
        price_cents: null,
        data: { ...r },
        internal_data: {},
      })),
    ],
    map_pins: pins.filter(p => p.lat != null && p.lng != null).map(p => ({ label: p.label, type: p.type as any, lat: p.lat!, lng: p.lng! })),
  }), [q, lodgings, flights, cruises, transfers, insurances, tours, rentals, pins])

  const firstRun = useRef(true)
  const payloadJson = JSON.stringify(payload)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaveState('saving')
    const timer = setTimeout(async () => {
      const res = await saveQuotation(orgSlug, q0.id, payload)
      if (res.ok) setSaveState('saved')
      else { setSaveState('error'); toast.error(res.error || 'Erro ao salvar') }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadJson])

  /* ─────── ações ─────── */
  const missing: string[] = []
  if (!q.title) missing.push('título')
  if (!q.start_date) missing.push('data de ida')
  if (!q.price_per_person_cents) missing.push('valor por pessoa')

  // Indicador de completude — só o que é realmente necessário pra uma
  // cotação comercial válida (não bloqueia nada, só orienta o vendedor).
  const completenessChecks: { label: string; done: boolean }[] = [
    { label: 'Título', done: !!q.title },
    { label: 'Destino', done: !!q.destinations[0]?.name },
    { label: 'Datas da viagem', done: !!q.start_date && !!q.end_date },
    { label: 'Passageiros', done: q.pax_adults > 0 },
    { label: 'Pelo menos um produto', done: lodgings.length + flights.length + cruises.length + transfers.length + insurances.length + tours.length + rentals.length > 0 },
    { label: 'Valor total', done: q.total_cents > 0 },
    { label: 'Forma de pagamento', done: q.payment_conditions.length > 0 },
    { label: 'Validade da tarifa', done: q.validity_days > 0 },
    { label: 'Política de cancelamento', done: !!q.cancellation_html?.trim() },
  ]
  const completeness = Math.round((completenessChecks.filter(c => c.done).length / completenessChecks.length) * 100)
  const missingLabels = completenessChecks.filter(c => !c.done).map(c => c.label)

  // Investimento centraliza o total, mas cada produto pode ter seu próprio
  // valor — mostrado aqui só como referência informativa (o total comercial
  // continua sendo digitado/calculado separadamente, não somado automaticamente,
  // pra não travar cotações com desconto/pacote fechado).
  const productBreakdown = [
    ...lodgings.filter(l => l.option_total_cents != null).map(l => ({ icon: '🏨', label: l.name || 'Hospedagem', price_cents: l.option_total_cents ?? null })),
    ...cruises.map(c => ({ icon: '🚢', label: c.ship_name || c.cruise_line || 'Cruzeiro', price_cents: c.total_cents ?? null })),
  ]

  async function onGenerateLink(rotate: boolean) {
    if (missing.length && !rotate) {
      toast.warning(`Campos pendentes: ${missing.join(', ')} — o link será gerado mesmo assim.`)
    }
    const res = await generateQuotationLink(orgSlug, q0.id, rotate)
    if (res.ok) {
      setPublicToken(res.token)
      setQ(s => ({ ...s, status: s.status === 'draft' ? 'sent' : s.status }))
      const url = `${window.location.origin}/p/${res.token}`
      try { await navigator.clipboard.writeText(url); toast.success('Link copiado para a área de transferência') }
      catch { toast.success('Link gerado') }
      router.refresh()
    } else toast.error(res.error)
  }

  async function onConvertToQuotation() {
    setSaleBusy(true)
    await saveQuotation(orgSlug, q0.id, payload)
    const res = await convertOfferToQuotation(orgSlug, q0.id)
    setSaleBusy(false)
    if (res.ok) { toast.success('Oferta copiada para uma nova cotação'); router.push(`/app/${orgSlug}/cotacoes/${res.id}`) }
    else toast.error(res.error)
  }

  async function taLookup(l: Lodging) {
    if (!l.name) { toast.error('Preencha o nome do hotel antes de buscar'); return }
    setTaBusy(l._key)
    const res = await tripadvisorLookup(orgSlug, l.name)
    setTaBusy(null)
    if (res.ok) {
      setLodgings(ls => ls.map(x => {
        if (x._key !== l._key) return x
        // Descrição: prioriza o texto editorial real do TripAdvisor; se não
        // vier, monta um rascunho com nota/endereço. Só quando o campo ainda
        // está vazio — nunca sobrescreve um texto que o usuário já escreveu.
        const draftParts = [
          res.data.rating && res.data.reviews_count
            ? `Avaliado com nota ${res.data.rating} no TripAdvisor (${res.data.reviews_count} avaliações).`
            : null,
          res.data.address ? `Endereço: ${res.data.address}.` : null,
        ].filter(Boolean)
        const draftDescription = res.data.description
          ? `<p>${res.data.description}</p>`
          : draftParts.length ? `<p>${draftParts.join(' ')}</p>` : x.description_html
        // Fotos: junta as já cadastradas com as novas do TripAdvisor,
        // sem duplicar, até 10 no total — buscar de novo deve trazer mais
        // fotos, não travar em quem já tinha alguma.
        const mergedPhotos = Array.from(new Set([...(x.photos || []), ...((res.data.photos || []) as string[])])).slice(0, 10)
        return {
          ...x,
          // Nome mantido do jeito que o usuário digitou — não sobrescreve
          // com o nome oficial do TripAdvisor.
          tripadvisor_location_id: res.location_id,
          tripadvisor_data: res.data,
          lat: x.lat ?? res.data.lat ?? null,
          lng: x.lng ?? res.data.lng ?? null,
          photos: mergedPhotos,
          description_html: x.description_html?.trim() ? x.description_html : draftDescription,
        }
      }))
      toast.success(`TripAdvisor vinculado: ${res.name}`)
    } else toast.error(res.error)
  }

  async function pinGeocode(p: Pin) {
    const query = p._query || p.label
    if (!query) { toast.error('Digite o endereço/local do pin'); return }
    setGeoBusy(p._key)
    const res = await geocodePlace(orgSlug, query)
    setGeoBusy(null)
    if (res.ok) {
      setPins(ps => ps.map(x => x._key === p._key ? { ...x, lat: res.lat, lng: res.lng, label: x.label || query } : x))
      toast.success('Pin posicionado no mapa')
    } else toast.error(res.error)
  }

  const publicUrl = publicToken ? `/p/${publicToken}` : null

  /* ═════════════ render ═════════════ */
  const form = (
    <div className="space-y-4 pb-24">
      <GroupSection id="resumo" active={activeGroup}>
      {/* CAPA */}
      <EditBlock id="blk-capa" icon={ImageIcon} title="Capa">
        <div className="grid grid-cols-2 gap-3">
          <F label="Título (H1 do hero)"><Input value={q.title} onChange={e => setQ(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Punta Cana, 7 noites à beira-mar" /></F>
          <F label="Subtítulo (H2)"><Input value={q.subtitle} onChange={e => setQ(s => ({ ...s, subtitle: e.target.value }))} placeholder="Ex.: All-inclusive no Caribe — sol, mar e descanso" /></F>
        </div>
        {isOffer ? (
          <div className="grid grid-cols-2 gap-3">
            <F label="Categoria (vitrine)"><Input value={q.offer_category} onChange={e => setQ(s => ({ ...s, offer_category: e.target.value }))} placeholder="Ex.: Praia, Lua de mel, Nacional" /></F>
            <F label="Publicar na vitrine" hint="aparece no link público da vitrine quando ligado">
              <label className="flex items-center gap-2 h-9 text-sm">
                <Switch checked={q.offer_published} onCheckedChange={v => setQ(s => ({ ...s, offer_published: v }))} />
                {q.offer_published ? 'Publicada' : 'Rascunho (oculta)'}
              </label>
            </F>
          </div>
        ) : (
          <div className="flex gap-3 items-start">
            <div className="flex-1 min-w-0 space-y-3">
              <F label="Contato do CRM" hint="liga a cotação ao lead da pipeline (timeline + lead scoring) — o nome do cliente vem daqui">
                <Select value={q.contato_id || 'none'}
                  onValueChange={v => setQ(s => {
                    const lead = leads.find(l => l.id === v)
                    return { ...s, contato_id: v === 'none' ? null : v, client_name: v === 'none' ? s.client_name : (lead?.name || s.client_name) }
                  })}>
                  <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem vínculo</SelectItem>
                    {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Nome do cliente" hint={q.contato_id ? 'vem do contato vinculado acima' : undefined}>
                <Input value={q.client_name} disabled={!!q.contato_id}
                  onChange={e => setQ(s => ({ ...s, client_name: e.target.value }))} placeholder="Ex.: Ricardo Almeida" />
              </F>
            </div>
            <div className="w-1/2 shrink-0">
              <F label="Imagem de capa">
                <CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))}
                  unsplashHint={q.destinations[0]?.name || ''} />
              </F>
            </div>
          </div>
        )}
        {isOffer && (
          <F label="Imagem de capa">
            <CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))}
              unsplashHint={q.destinations[0]?.name || ''} />
          </F>
        )}
      </EditBlock>

      {/* VIAGEM */}
      <EditBlock id="blk-viagem" icon={MapPin} title="Viagem">
        <div className="grid grid-cols-4 gap-3">
          <F label="Origem"><Input value={q.origin_label} onChange={e => setQ(s => ({ ...s, origin_label: e.target.value }))} placeholder="Florianópolis" /></F>
          <F label="Destino"><Input placeholder="Ilhéus, Brasil" value={q.destinations[0]?.name || ''}
            onChange={e => setQ(s => ({ ...s, destinations: [{ name: e.target.value, country: '' }] }))} /></F>
          <F label="Data de ida"><Input type="date" value={q.start_date} onChange={e => setQ(s => ({ ...s, start_date: e.target.value }))} /></F>
          <F label="Data de volta"><Input type="date" value={q.end_date} onChange={e => setQ(s => ({ ...s, end_date: e.target.value }))} /></F>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <F label="Adultos"><Input type="number" min={0} maxLength={3} className="w-16" value={q.pax_adults} onChange={e => setQ(s => ({ ...s, pax_adults: Math.max(0, parseInt(e.target.value) || 0) }))} /></F>
          <F label="Crianças"><Input type="number" min={0} maxLength={3} className="w-16" value={q.pax_children} onChange={e => {
            const n = Math.max(0, parseInt(e.target.value) || 0)
            setQ(s => ({ ...s, pax_children: n, children_ages: s.children_ages.slice(0, n) }))
          }} /></F>
          {q.pax_children > 0 && (
            <F label="Idades das crianças">
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: q.pax_children }).map((_, i) => (
                  <Input key={i} type="number" min={0} max={17} className="w-16" value={q.children_ages[i] ?? ''}
                    onChange={e => setQ(s => { const n = [...s.children_ages]; n[i] = Math.min(17, Math.max(0, parseInt(e.target.value) || 0)); return { ...s, children_ages: n } })} />
                ))}
              </div>
            </F>
          )}
        </div>
      </EditBlock>

      {missingLabels.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Cotação {completeness}% completa</p>
          <p>Faltam: {missingLabels.join(', ')}.</p>
        </div>
      )}
      </GroupSection>

      <GroupSection id="conteudo" active={activeGroup}>
      {/* INTRODUÇÃO */}
      <EditBlock id="blk-intro" icon={Sparkles} title="Introdução">
        <ToggleRichField orgSlug={orgSlug} value={q.intro_html} onChange={html => setQ(s => ({ ...s, intro_html: html }))} />
      </EditBlock>

      </GroupSection>

      <QuotationEditorProductsGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        flights={flights} setFlights={setFlights} setFlightOcrOpen={setFlightOcrOpen}
        flightsTextOpen={flightsTextOpen} setFlightsTextOpen={setFlightsTextOpen}
        lodgings={lodgings} setLodgings={setLodgings} taBusy={taBusy} taLookup={taLookup}
        cruises={cruises} setCruises={setCruises} setCruiseOcrOpen={setCruiseOcrOpen}
        transfers={transfers} setTransfers={setTransfers}
        insurances={insurances} setInsurances={setInsurances}
        tours={tours} setTours={setTours}
        rentals={rentals} setRentals={setRentals}
      />

      <GroupSection id="conteudo" active={activeGroup}>
      {/* MAPA */}
      <EditBlock id="blk-mapa" icon={MapIcon} title="Mapa"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setPins(ps => [...ps, { _key: nk(), label: '', type: 'attraction' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Pin
        </Button>}>
        <p className="text-[11px] text-muted-foreground">O mapa da cotação mostra só os pins adicionados aqui — inclua hospedagens, atrações e aeroporto manualmente.</p>
        {pins.map(p => (
          <div key={p._key} className="rounded-lg border p-2.5 space-y-2">
            <div className="flex gap-1.5">
              <Select value={p.type} onValueChange={v => setPins(ps => ps.map(x => x._key === p._key ? { ...x, type: v } : x))}>
                <SelectTrigger className="w-[120px] shrink-0 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attraction">Atração</SelectItem>
                  <SelectItem value="airport">Aeroporto</SelectItem>
                  <SelectItem value="lodging">Hospedagem</SelectItem>
                  <SelectItem value="custom">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input className="flex-1" placeholder="Local (ex.: Isla Saona)" value={p._query ?? p.label}
                onChange={e => setPins(ps => ps.map(x => x._key === p._key ? { ...x, _query: e.target.value, label: e.target.value, lat: null, lng: null } : x))} />
              <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={geoBusy === p._key}
                title="Buscar coordenadas" onClick={() => pinGeocode(p)}>
                {geoBusy === p._key ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setPins(ps => ps.filter(x => x._key !== p._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {p.lat != null
              ? <p className="text-[11px] text-emerald-600">✓ posicionado ({p.lat!.toFixed(4)}, {p.lng!.toFixed(4)})</p>
              : <p className="text-[11px] text-amber-600">sem posição — clique na mira para buscar</p>}
          </div>
        ))}
      </EditBlock>

      {/* ITINERÁRIO — texto livre rico (fonte, cor, imagens) */}
      <EditBlock id="blk-itinerario" icon={Route} title="Itinerário">
        <p className="text-[11px] text-muted-foreground">
          Escreva o roteiro do jeito que preferir. Formate a letra (fonte, tamanho, cor),
          e insira imagens pelo botão, colando (Ctrl+V) ou arrastando para o texto.
        </p>
        <ItineraryEditor orgSlug={orgSlug} value={q.itinerary_html}
          onChange={html => setQ(s => ({ ...s, itinerary_html: html }))} />
      </EditBlock>

      {/* IMPORTANTE */}
      <EditBlock id="blk-importante" icon={AlertTriangle} title="Importante">
        <ToggleRichField orgSlug={orgSlug} value={q.important_html} onChange={html => setQ(s => ({ ...s, important_html: html }))} />
      </EditBlock>

      {/* O QUE INCLUI */}
      <EditBlock id="blk-inclui" icon={CheckCircle2} title="O que inclui">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Incluso"><StringList items={q.included} placeholder="Passagem aérea ida e volta" suggestions={INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, included: v }))} /></F>
          <F label="Não incluso"><StringList items={q.not_included} placeholder="Seguro viagem" suggestions={NOT_INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, not_included: v }))} /></F>
        </div>
      </EditBlock>

      {/* POLÍTICAS DE CANCELAMENTO */}
      <EditBlock id="blk-cancelamento" icon={AlertTriangle} title="Políticas de cancelamento">
        <ToggleRichField orgSlug={orgSlug} value={q.cancellation_html} onChange={html => setQ(s => ({ ...s, cancellation_html: html }))} />
      </EditBlock>
      </GroupSection>

      <QuotationEditorInvestimentoGroup
        activeGroup={activeGroup} q={q} setQ={setQ} paxTotal={paxTotal}
        lodgings={lodgings} setLodgings={setLodgings}
        productBreakdown={productBreakdown}
      />

      <QuotationEditorFechamentoGroup
        orgSlug={orgSlug} activeGroup={activeGroup} q={q} setQ={setQ}
        whatsappNumber={initial.org_settings?.whatsapp_number}
        footerProfiles={footerProfiles} footerProfileBusy={footerProfileBusy}
        applyFooterProfile={applyFooterProfile} saveFooterProfile={saveFooterProfile}
        removeFooterProfile={removeFooterProfile}
      />
    </div>
  )

  return (
    <div className="pt-3 pb-8">
      {/* Toolbar + navegação entre blocos — um único bloco sticky, sem espaço entre as duas linhas */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-5 bg-background/95 backdrop-blur border-b">
      <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/cotacoes`}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <span className="text-sm font-semibold truncate flex-1 min-w-[120px]">{q.title || 'Nova cotação'}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setExtractOpen(true)}>
          <Sparkles className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Autopreencher com IA</span>
        </Button>
        {!isOffer && (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={`/app/${orgSlug}/cotacoes/${q0.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileText className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Gerar PDF</span>
            </a>
          </Button>
        )}
        {saveState === 'error' && (
          <span className="text-[11px] text-destructive">Erro ao salvar</span>
        )}
        {publicUrl && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + publicUrl); toast.success('Link copiado') } catch { toast.error('Não foi possível copiar') }
            }}><Copy className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Copiar link</span></Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Abrir</span></a>
            </Button>
          </>
        )}
        {!publicToken && (
          <Button type="button" size="sm" onClick={() => onGenerateLink(false)}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> Gerar link
          </Button>
        )}
        {isOffer && (
          <Button type="button" size="sm" variant="secondary" onClick={onConvertToQuotation} disabled={saleBusy}>
            {saleBusy ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 sm:mr-1" />}
            <span className="hidden sm:inline">Converter em cotação</span>
          </Button>
        )}
        {/* Enviar ao cliente / Adicionar a ofertas / Gerar reserva ficam na
            prévia da lista (ProposalsList.tsx → ProposalDetail), ao lado de
            "Duplicar" — menos botões aqui, o essencial pra quem tá editando. */}
      </div>
      <GroupNavMobile active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
      </div>

      <div className="mt-[3px] flex gap-4 items-start">
        <GroupNavSidebar active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
        <div className="flex-1 min-w-0 flex justify-center">
          <div className="w-full max-w-4xl">{form}</div>
        </div>
        {/* Espaçador simétrico à sidebar — sem isso o conteúdo fica
            centralizado só no espaço restante (que já começa deslocado pra
            direita pela largura da sidebar), não na tela inteira. */}
        <div className="hidden md:block w-44 shrink-0" aria-hidden />
      </div>

      <DocumentExtractDialog
        orgSlug={orgSlug}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        title="Autopreencher com IA"
        description="Envie o voucher/orçamento (PDF ou imagem) — a IA lê o documento e preenche cliente, destino, datas, hospedagem, voos e valor. Revise antes de salvar."
        onApply={data => handleExtracted(data)}
      />

      <FlightOcrDialog
        orgSlug={orgSlug}
        open={flightOcrOpen}
        onOpenChange={setFlightOcrOpen}
        onApply={legs => handleFlightLegsExtracted(legs)}
      />

      <CruiseOcrDialog
        orgSlug={orgSlug}
        open={cruiseOcrOpen}
        onOpenChange={setCruiseOcrOpen}
        onApply={data => handleCruiseExtracted(data)}
      />
    </div>
  )
}
