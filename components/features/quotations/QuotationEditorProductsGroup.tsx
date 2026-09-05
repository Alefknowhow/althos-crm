'use client'

/**
 * Grupo "Produtos" do editor de cotação — Aéreo, Hospedagens, Cruzeiro,
 * Transfers, Seguros, Passeios/Ingressos e Locação de veículo.
 *
 * Extraído de QuotationEditor.tsx (pura movimentação de JSX, sem mudança de
 * comportamento) — recebe o estado relevante e os setters via props.
 */

import { cn } from '@/lib/utils'
import { cityFromAirportCode } from '@/lib/airports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Plus, Trash2, Loader2, Search,
  Plane, BedDouble, Sparkles,
  Ticket, Ship, Car, Shield, KeyRound, Star, Repeat,
} from 'lucide-react'

import { CABIN_LABELS } from './PublicQuotationView'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import {
  FARE_CONDITIONS, BOARD_OPTIONS,
  nk, centsToStr, strToCents,
  PhotoGallery,
  SortableList, F, EditBlock, type GroupId, GroupSection,
  Disclosure, BaggagePicker,
} from './QuotationEditorFields'
import type {
  Lodging, Flight, Cruise, Transfer, Insurance, Tour, Rental, QuotationTopState,
} from './QuotationEditorTypes'

export default function QuotationEditorProductsGroup({
  orgSlug, activeGroup, q, setQ,
  flights, setFlights, setFlightOcrOpen, flightsTextOpen, setFlightsTextOpen,
  lodgings, setLodgings, taBusy, taLookup,
  cruises, setCruises, setCruiseOcrOpen,
  transfers, setTransfers,
  insurances, setInsurances,
  tours, setTours,
  rentals, setRentals,
}: {
  orgSlug: string
  activeGroup: GroupId
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  flights: Flight[]; setFlights: React.Dispatch<React.SetStateAction<Flight[]>>
  setFlightOcrOpen: (v: boolean) => void
  flightsTextOpen: boolean; setFlightsTextOpen: (v: boolean) => void
  lodgings: Lodging[]; setLodgings: React.Dispatch<React.SetStateAction<Lodging[]>>
  taBusy: string | null; taLookup: (l: Lodging) => void
  cruises: Cruise[]; setCruises: React.Dispatch<React.SetStateAction<Cruise[]>>
  setCruiseOcrOpen: (v: boolean) => void
  transfers: Transfer[]; setTransfers: React.Dispatch<React.SetStateAction<Transfer[]>>
  insurances: Insurance[]; setInsurances: React.Dispatch<React.SetStateAction<Insurance[]>>
  tours: Tour[]; setTours: React.Dispatch<React.SetStateAction<Tour[]>>
  rentals: Rental[]; setRentals: React.Dispatch<React.SetStateAction<Rental[]>>
}) {
  return (
    <GroupSection id="produtos" active={activeGroup}>
      {/* AÉREO */}
      <EditBlock id="blk-aereo" icon={Plane} title="Aéreo"
        action={<div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setFlightOcrOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Ler com IA
          </Button>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setFlights(fs => [...fs, { _key: nk(), leg_type: fs.length === 0 ? 'outbound' : 'inbound', baggage: [], cabin_class: 'economica' }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Trecho
          </Button>
        </div>}>
        <div className="flex flex-wrap gap-1.5">
          {FARE_CONDITIONS.map(fc => {
            const active = q.flight_fare_conditions.includes(fc.key)
            return (
              <button key={fc.key} type="button"
                onClick={() => setQ(s => ({
                  ...s,
                  flight_fare_conditions: active ? s.flight_fare_conditions.filter(k => k !== fc.key) : [...s.flight_fare_conditions, fc.key],
                }))}
                className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${
                  active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}>
                {fc.label}
              </button>
            )
          })}
        </div>
        {flights.length === 0 && <p className="text-sm text-muted-foreground">Nenhum trecho aéreo.</p>}
        <SortableList items={flights} onReorder={setFlights} render={(f) => (
          <>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Trecho</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -mr-1 text-destructive hover:bg-destructive/10"
                title="Remover trecho" onClick={() => setFlights(fs => fs.filter(x => x._key !== f._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Tipo">
                <Select value={f.leg_type} onValueChange={v => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, leg_type: v } : x))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outbound">Ida</SelectItem>
                    <SelectItem value="inbound">Volta</SelectItem>
                    <SelectItem value="connection">Conexão</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Companhia"><Input placeholder="Copa Airlines" value={f.airline || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, airline: e.target.value } : x))} /></F>
              <F label="Código do voo"><Input placeholder="LA3380" value={f.flight_number || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, flight_number: e.target.value } : x))} /></F>
              <F label="Classe">
                <Select value={f.cabin_class || 'economica'}
                  onValueChange={v => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, cabin_class: v === 'none' ? null : v } : x))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não exibir</SelectItem>
                    {Object.entries(CABIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            </div>
            <div className="flex flex-wrap items-start gap-2">
              <div className="w-20 shrink-0">
                <F label="Origem" hint={cityFromAirportCode(f.from_code) || (f.from_code ? 'sigla não reconhecida' : undefined)}>
                  <Input placeholder="FLN" maxLength={3} value={f.from_code || ''} onChange={e => {
                    const code = e.target.value.toUpperCase()
                    setFlights(fs => fs.map(x => x._key === f._key ? { ...x, from_code: code, from_city: cityFromAirportCode(code) || x.from_city } : x))
                  }} />
                </F>
              </div>
              <div className="w-20 shrink-0">
                <F label="Destino" hint={cityFromAirportCode(f.to_code) || (f.to_code ? 'sigla não reconhecida' : undefined)}>
                  <Input placeholder="PUJ" maxLength={3} value={f.to_code || ''} onChange={e => {
                    const code = e.target.value.toUpperCase()
                    setFlights(fs => fs.map(x => x._key === f._key ? { ...x, to_code: code, to_city: cityFromAirportCode(code) || x.to_city } : x))
                  }} />
                </F>
              </div>
              <div className="flex-1 min-w-[180px]">
                <F label="Conexão (local + tempo de espera)"><Input placeholder="Panamá (PTY) — 2h35 de conexão" value={f.stopover_label || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, stopover_label: e.target.value } : x))} /></F>
              </div>
            </div>
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                <div className="w-56 shrink-0">
                  <F label="Partida (data e hora)">
                    <Input type="datetime-local" className="w-full" value={f.date && f.departure_time ? `${f.date}T${f.departure_time}` : ''} onChange={e => {
                      const [date, time] = e.target.value.split('T')
                      setFlights(fs => fs.map(x => x._key === f._key ? { ...x, date: date || null, departure_time: time || null } : x))
                    }} />
                  </F>
                </div>
                <div className="w-56 shrink-0">
                  <F label="Chegada (data e hora)">
                    <Input type="datetime-local" className="w-full" value={f.arrival_date && f.arrival_time ? `${f.arrival_date}T${f.arrival_time}` : ''} onChange={e => {
                      const [date, time] = e.target.value.split('T')
                      setFlights(fs => fs.map(x => x._key === f._key ? { ...x, arrival_date: date || null, arrival_time: time || null } : x))
                    }} />
                  </F>
                </div>
              </div>
              <div className="shrink-0">
                <F label="Bagagens incluídas">
                  <BaggagePicker value={f.baggage}
                    onChange={b => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, baggage: b } : x))} />
                </F>
              </div>
            </div>
          </>
        )} />

        <div className="mt-3 pt-3 border-t">
          <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
            <Switch checked={flightsTextOpen} onCheckedChange={v => {
              setFlightsTextOpen(v)
              // Desligar limpa o texto — senão ele fica escondido mas ainda
              // preenchido, e continuaria substituindo os trechos estruturados
              // na proposta (regra: texto livre tem prioridade quando não vazio).
              if (!v) setQ(s => ({ ...s, flights_html: '' }))
            }} />
            Alternativa: descrever o aéreo em texto livre (cole prints da passagem direto no texto)
          </label>
          {flightsTextOpen && (
            <div className="mt-2">
              <ItineraryEditor orgSlug={orgSlug} value={q.flights_html || ''}
                onChange={html => setQ(s => ({ ...s, flights_html: html }))} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Use os trechos estruturados acima OU este campo — se preenchido, ele aparece no lugar dos trechos na proposta.
              </p>
            </div>
          )}
        </div>
      </EditBlock>

      {/* HOSPEDAGENS */}
      <EditBlock id="blk-hospedagens" icon={BedDouble} title="Hospedagens"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setLodgings(ls => [...ls, { _key: nk(), name: '', photos: [], check_in: q.start_date || null, check_out: q.end_date || null, check_in_time: '15:00', check_out_time: '12:00' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Hospedagem
        </Button>}>
        {lodgings.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hospedagem.</p>}
        <SortableList items={lodgings} onReorder={setLodgings} render={(l) => (
          <>
            <div className="flex gap-1.5">
              <Input className="flex-1" placeholder="Nome do hotel/resort" value={l.name}
                onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, name: e.target.value } : x))} />
              <Button type="button" variant="outline" size="sm" className="shrink-0" disabled={taBusy === l._key}
                title="Buscar no TripAdvisor (nota, fotos, localização)" onClick={() => taLookup(l)}>
                {taBusy === l._key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                <span className="ml-1 hidden sm:inline">TripAdvisor</span>
              </Button>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setLodgings(ls => ls.filter(x => x._key !== l._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {l.tripadvisor_data && (
              <>
                <p className="text-[11px] text-emerald-600">✓ TripAdvisor vinculado{l.tripadvisor_data.rating ? ` · nota ${l.tripadvisor_data.rating}` : ''}{l.tripadvisor_data.reviews_count ? ` · ${l.tripadvisor_data.reviews_count} avaliações` : ''}</p>
                {l.tripadvisor_data.address && (
                  <p className="text-[11px] text-muted-foreground">📍 {l.tripadvisor_data.address}</p>
                )}
              </>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Check-in"><Input type="date" value={l.check_in || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_in: e.target.value } : x))} /></F>
              <F label="Horário check-in"><Input type="time" value={l.check_in_time ?? '15:00'} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_in_time: e.target.value } : x))} /></F>
              <F label="Check-out"><Input type="date" value={l.check_out || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_out: e.target.value } : x))} /></F>
              <F label="Horário check-out"><Input type="time" value={l.check_out_time ?? '12:00'} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_out_time: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Categoria do quarto"><Input placeholder="Suíte The Level · vista jardim" value={l.room_category || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, room_category: e.target.value } : x))} /></F>
              <F label="Regime">
                <Select value={l.board || 'none'} onValueChange={v => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, board: v === 'none' ? null : v } : x))}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não exibir</SelectItem>
                    {BOARD_OPTIONS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Categoria do hotel">
                <div className="flex items-center gap-0.5 h-9">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      type="button"
                      title={`${n} estrela${n > 1 ? 's' : ''}`}
                      onClick={() => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, star_rating: x.star_rating === n ? null : n } : x))}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star className={cn('w-5 h-5', (l.star_rating || 0) >= n ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground/30')} />
                    </button>
                  ))}
                </div>
              </F>
            </div>
            <F label="Descrição">
              <ItineraryEditor orgSlug={orgSlug} value={l.description_html || ''}
                onChange={html => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, description_html: html } : x))} />
            </F>
            <F label="Fotos">
              <PhotoGallery orgSlug={orgSlug} photos={l.photos}
                onChange={p => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, photos: p } : x))} />
            </F>
            <label className="flex items-center gap-2 text-xs font-medium rounded-lg border p-2.5 bg-muted/20">
              <Switch checked={!!l.is_alternative_option}
                onCheckedChange={v => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, is_alternative_option: v } : x))} />
              Esta é uma opção alternativa (cliente escolhe esta OU outra hospedagem — preços editados em Investimento)
            </label>
          </>
        )} />
      </EditBlock>

      {/* CRUZEIRO — primeiro tipo de produto novo do Construtor de Viagens.
          Mesma infra de add/editar/ordenar/excluir (SortableList) que
          Hospedagens/Aéreo já usam; só os campos mudam. */}
      <EditBlock id="blk-cruzeiro" icon={Ship} title="Cruzeiro"
        action={<div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setCruiseOcrOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Ler com IA
          </Button>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setCruises(cs => [...cs, {
              _key: nk(), embark_date: q.start_date || null, disembark_date: q.end_date || null,
              pax_adults: q.pax_adults || null, pax_children: q.pax_children || null, days: [],
            }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Cruzeiro
          </Button>
        </div>}>
        {cruises.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cruzeiro nesta cotação.</p>}
        <SortableList items={cruises} onReorder={setCruises} render={(c) => (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">
                {c.ship_name || c.cruise_line || 'Cruzeiro sem nome'}
                {c.duration_nights ? ` · ${c.duration_nights} noites` : ''}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 -mr-1 text-destructive hover:bg-destructive/10"
                title="Remover cruzeiro" onClick={() => setCruises(cs => cs.filter(x => x._key !== c._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>

            {/* Essencial */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Companhia marítima"><Input placeholder="MSC Cruzeiros" value={c.cruise_line || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cruise_line: e.target.value } : x))} /></F>
              <F label="Navio"><Input placeholder="MSC Seaview" value={c.ship_name || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, ship_name: e.target.value } : x))} /></F>
              <F label="Roteiro"><Input placeholder="Caribe" value={c.itinerary_name || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, itinerary_name: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Embarque (data)"><Input type="date" value={c.embark_date || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, embark_date: e.target.value } : x))} /></F>
              <F label="Desembarque (data)"><Input type="date" value={c.disembark_date || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, disembark_date: e.target.value } : x))} /></F>
              <F label="Duração (noites)"><Input type="number" min={1} value={c.duration_nights ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, duration_nights: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
              <F label="Cabine — Tipo de cabine"><Input placeholder="Balcony" value={c.cabin_category || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_category: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Porto de embarque"><Input placeholder="Miami" value={c.embark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, embark_port: e.target.value } : x))} /></F>
              <F label="Porto de desembarque"><Input placeholder="Miami" value={c.disembark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, disembark_port: e.target.value } : x))} /></F>
              <F label="Adultos"><Input type="number" min={0} value={c.pax_adults ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_adults: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
              <F label="Crianças"><Input type="number" min={0} value={c.pax_children ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_children: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Valor da cabine (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.cabin_price_cents)}
                onChange={e => { const v = strToCents(e.target.value); setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_price_cents: v, total_cents: (v || 0) + (x.taxes_cents || 0) } : x)) }} /></F>
              <F label="Taxas (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.taxes_cents)}
                onChange={e => { const v = strToCents(e.target.value); setCruises(cs => cs.map(x => x._key === c._key ? { ...x, taxes_cents: v, total_cents: (x.cabin_price_cents || 0) + (v || 0) } : x)) }} /></F>
              <F label="Valor do produto (R$)" hint="taxas + valor da cabine">
                <Input disabled value={centsToStr((c.cabin_price_cents || 0) + (c.taxes_cents || 0))} />
              </F>
            </div>

            {/* Categoria/deck/localização/vista da cabine base — ficam
                acima de "Opções de cabine" por pedido explícito (eram
                antes recolhidos no Disclosure "Mais detalhes"). */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Categoria"><Input placeholder="Varanda" value={c.cabin_type || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_type: e.target.value } : x))} /></F>
              <F label="Deck"><Input placeholder="9" value={c.deck || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, deck: e.target.value } : x))} /></F>
              <F label="Localização"><Input placeholder="Meio do navio" value={c.location || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, location: e.target.value } : x))} /></F>
              <F label="Vista"><Input placeholder="Mar" value={c.view || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, view: e.target.value } : x))} /></F>
            </div>

            {/* Opções de cabine — cliente escolhe entre 2+ categorias. O
                valor de cada opção é o UPGRADE em relação à cabine base
                acima (0 pra base, positivo pras demais) — é isso que
                aparece no orçamento impresso/público como "+ R$X upgrade". */}
            <div className="border rounded-md p-2.5 bg-muted/30">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-muted-foreground">Opções de cabine (cliente escolhe)</p>
                <Button type="button" variant="outline" size="sm" className="h-6 text-[11px] px-2"
                  onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: [...(x.cabin_options || []), { _key: nk(), label: '', price_cents: null }] } : x))}>
                  <Plus className="w-3 h-3 mr-1" /> Opção
                </Button>
              </div>
              {(c.cabin_options || []).length === 0 && (
                <p className="text-[11px] text-muted-foreground">Nenhuma — a proposta usa só a cabine base acima.</p>
              )}
              {(c.cabin_options || []).length > 0 && (
                <div className="hidden sm:grid grid-cols-[1fr_90px_1fr_90px_110px_32px] gap-1.5 mb-1 px-0.5">
                  <span className="text-[10px] text-muted-foreground">Tipo da cabine</span>
                  <span className="text-[10px] text-muted-foreground">Deck</span>
                  <span className="text-[10px] text-muted-foreground">Localização</span>
                  <span className="text-[10px] text-muted-foreground">Vista</span>
                  <span className="text-[10px] text-muted-foreground">Valor upgrade</span>
                  <span />
                </div>
              )}
              {(c.cabin_options || []).map(opt => (
                <div key={opt._key} className="grid grid-cols-2 sm:grid-cols-[1fr_90px_1fr_90px_110px_32px] gap-1.5 mb-1.5 last:mb-0">
                  <Input placeholder="Ex.: Cabine Balcony" value={opt.label}
                    onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, label: e.target.value } : o) } : x))} />
                  <Input placeholder="Deck" value={opt.deck || ''}
                    onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, deck: e.target.value } : o) } : x))} />
                  <Input placeholder="Localização" value={opt.location || ''}
                    onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, location: e.target.value } : o) } : x))} />
                  <Input placeholder="Vista" value={opt.view || ''}
                    onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, view: e.target.value } : o) } : x))} />
                  <Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(opt.price_cents)}
                    onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).map(o => o._key === opt._key ? { ...o, price_cents: strToCents(e.target.value) } : o) } : x))} />
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_options: (x.cabin_options || []).filter(o => o._key !== opt._key) } : x))}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Recomendado */}
            <Disclosure label="Mais detalhes da cabine e pacotes">
              <label className="flex items-center gap-2 text-xs font-medium">
                <Switch checked={!!c.cabin_guaranteed} onCheckedChange={v => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_guaranteed: v } : x))} />
                Cabine garantida (número definido só no embarque)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <F label="Ocupação"><Input placeholder="2 adultos em cabine dupla" value={c.occupancy_label || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, occupancy_label: e.target.value } : x))} /></F>
                <F label="Desconto (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.discount_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, discount_cents: strToCents(e.target.value) } : x))} /></F>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <F label="Pacote de bebidas"><Input placeholder="Easy Package" value={c.pkg_drinks || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_drinks: e.target.value } : x))} /></F>
                <F label="Valor upgrade bebidas (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.pkg_drinks_upgrade_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_drinks_upgrade_cents: strToCents(e.target.value) } : x))} /></F>
                <F label="Internet"><Input placeholder="2 dispositivos" value={c.pkg_internet || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_internet: e.target.value } : x))} /></F>
                <F label="Restaurantes"><Input placeholder="Especialidade incluso" value={c.pkg_restaurants || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_restaurants: e.target.value } : x))} /></F>
                <F label="Gorjetas/taxa de serviço"><Input placeholder="Inclusas" value={c.pkg_gratuities || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_gratuities: e.target.value } : x))} /></F>
                <F label="Outros pacotes"><Input placeholder="Fotos, spa…" value={c.pkg_others || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pkg_others: e.target.value } : x))} /></F>
                <F label="Adicionais (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.extras_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, extras_cents: strToCents(e.target.value) } : x))} /></F>
              </div>

              {/* Itinerário por dia */}
              <F label="Itinerário (dia a dia)">
                <div className="space-y-1.5">
                  {c.days.map((d, i) => (
                    <div key={d._key} className="grid grid-cols-[36px_1fr_1fr_70px_70px_28px] gap-1.5 items-center">
                      <Input type="number" min={1} className="text-center px-1" placeholder={`${i + 1}`} value={d.day_number ?? ''}
                        onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, day_number: e.target.value ? parseInt(e.target.value) : null } : y) } : x))} />
                      <Input placeholder="Porto/destino (ou 'Navegação')" value={d.port || ''}
                        onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, port: e.target.value } : y) } : x))} />
                      <Input type="date" value={d.date || ''}
                        onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, date: e.target.value } : y) } : x))} />
                      <Input placeholder="Chegada" value={d.arrival || ''}
                        onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, arrival: e.target.value } : y) } : x))} />
                      <Input placeholder="Saída" value={d.departure || ''}
                        onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.map(y => y._key === d._key ? { ...y, departure: e.target.value } : y) } : x))} />
                      <Button type="button" variant="ghost" size="icon" className="w-7 h-7 text-destructive hover:bg-destructive/10"
                        onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: x.days.filter(y => y._key !== d._key) } : x))}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm"
                    onClick={() => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, days: [...x.days, { _key: nk(), day_number: x.days.length + 1 }] } : x))}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Dia
                  </Button>
                </div>
              </F>
            </Disclosure>

            {/* Avançado / interno — nunca aparece na proposta */}
            <Disclosure label="Informações avançadas (interno, não aparece na proposta)">
              <div className="grid grid-cols-2 gap-2">
                <F label="Fornecedor"><Input value={c.supplier || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, supplier: e.target.value } : x))} /></F>
                <F label="Código da tarifa"><Input value={c.fare_code || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, fare_code: e.target.value } : x))} /></F>
              </div>
              <F label="Custo (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.cost_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cost_cents: strToCents(e.target.value) } : x))} /></F>
              <F label="Observações internas"><Textarea rows={2} value={c.internal_notes || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, internal_notes: e.target.value } : x))} /></F>
            </Disclosure>
          </>
        )} />
      </EditBlock>

      {/* TRANSFERS */}
      <EditBlock id="blk-transfers" icon={Car} title="Transfers"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setTransfers(ts => [...ts, { _key: nk(), date: q.start_date || null }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Transfer
        </Button>}>
        {transfers.length === 0 && <p className="text-sm text-muted-foreground">Nenhum transfer.</p>}
        <SortableList items={transfers} onReorder={setTransfers} render={(t) => (
          <>
            <div className="flex items-center justify-between">
              <button type="button"
                onClick={() => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, round_trip: !x.round_trip } : x))}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs transition-colors ${
                  t.round_trip ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                }`}>
                <Repeat className="w-3.5 h-3.5" /> Ida e volta
              </button>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setTransfers(ts => ts.filter(x => x._key !== t._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Origem"><Input placeholder="Aeroporto GIG" value={t.origin || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, origin: e.target.value } : x))} /></F>
              <F label="Destino"><Input placeholder="Hotel" value={t.destination || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, destination: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Data"><Input type="date" value={t.date || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, date: e.target.value } : x))} /></F>
              <F label="Horário"><Input type="time" value={t.time || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, time: e.target.value } : x))} /></F>
              <F label="Veículo"><Input placeholder="Sedan executivo" value={t.vehicle || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, vehicle: e.target.value } : x))} /></F>
              <F label="Passageiros"><Input placeholder="3 pessoas" value={t.pax || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, pax: e.target.value } : x))} /></F>
            </div>
            {t.round_trip && (
              <div className="grid grid-cols-2 gap-2">
                <F label="Data da volta"><Input type="date" value={t.return_date || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, return_date: e.target.value } : x))} /></F>
                <F label="Horário da volta"><Input type="time" value={t.return_time || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, return_time: e.target.value } : x))} /></F>
              </div>
            )}
            <F label="Tipo"><Input placeholder="Privativo / Compartilhado" value={t.transfer_type || ''} onChange={e => setTransfers(ts => ts.map(x => x._key === t._key ? { ...x, transfer_type: e.target.value } : x))} /></F>
          </>
        )} />
      </EditBlock>

      {/* SEGUROS */}
      <EditBlock id="blk-seguros" icon={Shield} title="Seguro viagem"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setInsurances(ins => [...ins, { _key: nk(), date_start: q.start_date || null, date_end: q.end_date || null }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Seguro
        </Button>}>
        {insurances.length === 0 && <p className="text-sm text-muted-foreground">Nenhum seguro.</p>}
        <SortableList items={insurances} onReorder={setInsurances} render={(s) => (
          <>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setInsurances(ins => ins.filter(x => x._key !== s._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Seguradora"><Input placeholder="Assist Card" value={s.insurer || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, insurer: e.target.value } : x))} /></F>
              <F label="Plano"><Input placeholder="Gold 60" value={s.plan || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, plan: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Destino"><Input placeholder="Nacional / Internacional" value={s.destination || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, destination: e.target.value } : x))} /></F>
              <F label="Início"><Input type="date" value={s.date_start || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, date_start: e.target.value } : x))} /></F>
              <F label="Fim"><Input type="date" value={s.date_end || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, date_end: e.target.value } : x))} /></F>
              <F label="Viajantes"><Input placeholder="3 viajantes" value={s.travelers || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, travelers: e.target.value } : x))} /></F>
            </div>
            <F label="Coberturas principais"><Textarea rows={2} placeholder="Cobertura médica de até R$ 60.000, cancelamento de viagem…" value={s.coverage || ''} onChange={e => setInsurances(ins => ins.map(x => x._key === s._key ? { ...x, coverage: e.target.value } : x))} /></F>
          </>
        )} />
      </EditBlock>

      {/* PASSEIOS/INGRESSOS (estruturados) */}
      <EditBlock id="blk-tours" icon={Ticket} title="Ingressos e passeios"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setTours(ts => [...ts, { _key: nk(), date: q.start_date || null }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Passeio
        </Button>}>
        {tours.length === 0 && <p className="text-sm text-muted-foreground">Nenhum passeio/ingresso estruturado — use &quot;Passeios e Ingressos&quot; em Conteúdo pra texto livre.</p>}
        <SortableList items={tours} onReorder={setTours} render={(t) => (
          <>
            <div className="flex gap-1.5">
              <Input className="flex-1" placeholder="City Tour Rio de Janeiro" value={t.name || ''} onChange={e => setTours(ts => ts.map(x => x._key === t._key ? { ...x, name: e.target.value } : x))} />
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setTours(ts => ts.filter(x => x._key !== t._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Data"><Input type="date" value={t.date || ''} onChange={e => setTours(ts => ts.map(x => x._key === t._key ? { ...x, date: e.target.value } : x))} /></F>
              <F label="Duração"><Input placeholder="4 horas" value={t.duration_label || ''} onChange={e => setTours(ts => ts.map(x => x._key === t._key ? { ...x, duration_label: e.target.value } : x))} /></F>
              <F label="Inclui"><Input placeholder="Guia, transporte" value={t.includes || ''} onChange={e => setTours(ts => ts.map(x => x._key === t._key ? { ...x, includes: e.target.value } : x))} /></F>
            </div>
            <F label="Descrição"><Textarea rows={2} placeholder="Cristo Redentor + Pão de Açúcar" value={t.description || ''} onChange={e => setTours(ts => ts.map(x => x._key === t._key ? { ...x, description: e.target.value } : x))} /></F>
          </>
        )} />
      </EditBlock>

      {/* LOCAÇÃO DE VEÍCULO */}
      <EditBlock id="blk-locacao" icon={KeyRound} title="Locação de veículo"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setRentals(rs => [...rs, { _key: nk(), pickup_date: q.start_date || null, dropoff_date: q.end_date || null }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Locação
        </Button>}>
        {rentals.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma locação.</p>}
        <SortableList items={rentals} onReorder={setRentals} render={(r) => (
          <>
            <div className="flex justify-end">
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setRentals(rs => rs.filter(x => x._key !== r._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Locadora"><Input placeholder="Localiza" value={r.company || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, company: e.target.value } : x))} /></F>
              <F label="Categoria do veículo"><Input placeholder="Econômico / SUV" value={r.vehicle_category || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, vehicle_category: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Local de retirada"><Input placeholder="Aeroporto GIG" value={r.pickup_location || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, pickup_location: e.target.value } : x))} /></F>
              <F label="Local de devolução"><Input placeholder="Aeroporto GIG" value={r.dropoff_location || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, dropoff_location: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <F label="Retirada"><Input type="date" value={r.pickup_date || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, pickup_date: e.target.value } : x))} /></F>
              <F label="Devolução"><Input type="date" value={r.dropoff_date || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, dropoff_date: e.target.value } : x))} /></F>
            </div>
            <F label="Descrição / condições da locação">
              <Textarea rows={3} placeholder="Franquia de km, seguro, categoria de combustível, condutor adicional, condições de devolução…"
                value={r.notes || ''} onChange={e => setRentals(rs => rs.map(x => x._key === r._key ? { ...x, notes: e.target.value } : x))} />
            </F>
          </>
        )} />
      </EditBlock>
    </GroupSection>
  )
}
