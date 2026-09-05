import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { cityFromAirportCode } from '@/lib/airports'
import { saveQuotation, generateQuotationLink, tripadvisorLookup, convertOfferToQuotation, type QuotationFull } from '@/actions/quotations'
import { geocodePlace } from '@/actions/travel-proposals'
import { PAYMENT_METHODS, withKeys, type GroupId } from './QuotationEditorFields'
import type {
  Lodging, Flight, Pin, Cruise, Transfer, Insurance, Tour, Rental,
} from './QuotationEditorTypes'
import { buildQuotationPayload } from './buildQuotationPayload'
import { useQuotationExtractHandlers } from './useQuotationExtractHandlers'
import { useQuotationFooterProfiles } from './useQuotationFooterProfiles'

/**
 * Todo o estado/lógica de negócio do editor de cotação — construção do
 * estado inicial a partir do registro salvo, os produtos (hospedagem, voo,
 * cruzeiro, etc.), autosave com debounce, sincronização de datas e os
 * handlers de ações (gerar link, converter oferta, lookups de TripAdvisor/
 * geocoding). Os handlers de "Ler com IA" e o payload de saveQuotation
 * vivem em módulos-irmãos (useQuotationExtractHandlers, buildQuotationPayload)
 * só pra manter este arquivo abaixo do limite de tamanho — pura extração de
 * código, o componente continua dono da árvore JSX.
 */
export function useQuotationEditorState({ orgSlug, initial, isOffer }: {
  orgSlug: string
  initial: QuotationFull
  isOffer: boolean
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

  const { footerProfiles, footerProfileBusy, applyFooterProfile, saveFooterProfile, removeFooterProfile } =
    useQuotationFooterProfiles(orgSlug, setQ, q)

  const { handleCruiseExtracted, handleFlightLegsExtracted, handleExtracted } = useQuotationExtractHandlers({
    setQ, setLodgings, setFlights, setCruises, setTransfers, setInsurances, setTours, setRentals,
  })

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
  const payload = useMemo(
    () => buildQuotationPayload(q, isOffer, { lodgings, flights, cruises, transfers, insurances, tours, rentals, pins }),
    [q, lodgings, flights, cruises, transfers, insurances, tours, rentals, pins],
  )

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

  return {
    q0, q, setQ,
    lodgings, setLodgings, flights, setFlights, pins, setPins,
    cruises, setCruises, transfers, setTransfers, insurances, setInsurances,
    tours, setTours, rentals, setRentals,
    publicToken, saveState, taBusy, geoBusy, saleBusy,
    extractOpen, setExtractOpen, flightOcrOpen, setFlightOcrOpen,
    activeGroup, setActiveGroup, flightsTextOpen, setFlightsTextOpen, cruiseOcrOpen, setCruiseOcrOpen,
    footerProfiles, footerProfileBusy, applyFooterProfile, saveFooterProfile, removeFooterProfile,
    handleCruiseExtracted, handleFlightLegsExtracted, handleExtracted,
    paxTotal, completeness, missingLabels, productBreakdown,
    onGenerateLink, onConvertToQuotation, taLookup, pinGeocode, publicUrl,
  }
}
