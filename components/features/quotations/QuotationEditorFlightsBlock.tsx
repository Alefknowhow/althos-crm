'use client'

/**
 * Bloco "Aéreo" do grupo Produtos — extraído de
 * QuotationEditorProductsGroup.tsx (pura movimentação de JSX).
 */

import { cityFromAirportCode } from '@/lib/airports'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash2, Sparkles, Plane } from 'lucide-react'

import { CABIN_LABELS } from './PublicQuotationView'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import {
  FARE_CONDITIONS, nk, SortableList, F, EditBlock, BaggagePicker,
} from './QuotationEditorFields'
import type { Flight, QuotationTopState } from './QuotationEditorTypes'

export default function QuotationEditorFlightsBlock({
  orgSlug, q, setQ, flights, setFlights, setFlightOcrOpen, flightsTextOpen, setFlightsTextOpen,
}: {
  orgSlug: string
  q: QuotationTopState
  setQ: React.Dispatch<React.SetStateAction<QuotationTopState>>
  flights: Flight[]; setFlights: React.Dispatch<React.SetStateAction<Flight[]>>
  setFlightOcrOpen: (v: boolean) => void
  flightsTextOpen: boolean; setFlightsTextOpen: (v: boolean) => void
}) {
  return (
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
  )
}
