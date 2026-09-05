'use client'

/**
 * Blocos "Transfers", "Seguro viagem", "Ingressos e passeios" e "Locação de
 * veículo" do grupo Produtos — extraídos de QuotationEditorProductsGroup.tsx
 * (pura movimentação de JSX). Agrupados num único arquivo por serem pequenos
 * e seguirem o mesmo padrão simples de lista + campos.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Ticket, Car, Shield, KeyRound, Repeat } from 'lucide-react'

import { nk, SortableList, F, EditBlock } from './QuotationEditorFields'
import type { Transfer, Insurance, Tour, Rental, QuotationTopState } from './QuotationEditorTypes'

export function QuotationEditorTransfersBlock({
  q, transfers, setTransfers,
}: {
  q: QuotationTopState
  transfers: Transfer[]; setTransfers: React.Dispatch<React.SetStateAction<Transfer[]>>
}) {
  return (
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
  )
}

export function QuotationEditorInsuranceBlock({
  q, insurances, setInsurances,
}: {
  q: QuotationTopState
  insurances: Insurance[]; setInsurances: React.Dispatch<React.SetStateAction<Insurance[]>>
}) {
  return (
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
  )
}

export function QuotationEditorToursBlock({
  q, tours, setTours,
}: {
  q: QuotationTopState
  tours: Tour[]; setTours: React.Dispatch<React.SetStateAction<Tour[]>>
}) {
  return (
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
  )
}

export function QuotationEditorRentalsBlock({
  q, rentals, setRentals,
}: {
  q: QuotationTopState
  rentals: Rental[]; setRentals: React.Dispatch<React.SetStateAction<Rental[]>>
}) {
  return (
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
  )
}
