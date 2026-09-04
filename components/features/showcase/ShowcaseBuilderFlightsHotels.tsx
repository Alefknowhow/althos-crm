'use client'

/**
 * Flights + Hotels sections for ShowcaseBuilder. Prop-driven, split out
 * of ShowcaseBuilder.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Plane, Hotel, MapPin, Trash2 } from 'lucide-react'
import { SectionCard, Field, PhotoManager } from './ShowcaseBuilderShared'

export function DestinationsSection({ destinations, setDestinations }: { destinations: any[]; setDestinations: (v: any[]) => void }) {
  return (
    <SectionCard
      icon={MapPin} title="Destinos"
      action={
        <Button type="button" variant="outline" size="sm"
          onClick={() => setDestinations([...destinations, { name: '', briefing: '' }])}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Destino
        </Button>
      }
    >
      {(destinations || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum destino adicionado.</p>}
      {(destinations || []).map((d: any, i: number) => (
        <div key={i} className="rounded-lg border p-3 space-y-2">
          <div className="flex gap-2">
            <Input className="flex-1" placeholder="Destino (ex.: Cancún, México)" value={d.name || ''}
              onChange={e => { const n = [...destinations]; n[i] = { ...n[i], name: e.target.value }; setDestinations(n) }} />
            <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
              onClick={() => setDestinations(destinations.filter((_: any, j: number) => j !== i))}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          <Textarea placeholder="Mini briefing sobre o destino" value={d.briefing || ''}
            onChange={e => { const n = [...destinations]; n[i] = { ...n[i], briefing: e.target.value }; setDestinations(n) }} />
        </div>
      ))}
    </SectionCard>
  )
}

export function FlightsSection({ flights, setFlights }: { flights: any[]; setFlights: (v: any[]) => void }) {
  return (
    <SectionCard
      icon={Plane} title="Voos"
      action={
        <Button type="button" variant="outline" size="sm"
          onClick={() => setFlights([...flights, { airline: '', flight_number: '', origin: '', destination: '', departure_at: '', arrival_at: '', connections: '', baggage: '', policies: '' }])}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Voo
        </Button>
      }
    >
      {(flights || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum voo adicionado.</p>}
      {(flights || []).map((f: any, i: number) => {
        const upd = (patch: any) => { const n = [...flights]; n[i] = { ...n[i], ...patch }; setFlights(n) }
        return (
          <div key={i} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Voo {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => setFlights(flights.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Companhia aérea"><Input value={f.airline || ''} onChange={e => upd({ airline: e.target.value })} placeholder="Ex.: LATAM" /></Field>
              <Field label="Número do voo"><Input value={f.flight_number || ''} onChange={e => upd({ flight_number: e.target.value })} placeholder="Ex.: LA1234" /></Field>
              <Field label="Origem"><Input value={f.origin || ''} onChange={e => upd({ origin: e.target.value })} placeholder="GRU" /></Field>
              <Field label="Destino"><Input value={f.destination || ''} onChange={e => upd({ destination: e.target.value })} placeholder="CUN" /></Field>
              <Field label="Embarque"><Input value={f.departure_at || ''} onChange={e => upd({ departure_at: e.target.value })} placeholder="01/12 08:30" /></Field>
              <Field label="Chegada"><Input value={f.arrival_at || ''} onChange={e => upd({ arrival_at: e.target.value })} placeholder="01/12 14:10" /></Field>
              <Field label="Conexões"><Input value={f.connections || ''} onChange={e => upd({ connections: e.target.value })} placeholder="Ex.: 1 parada em PTY" /></Field>
              <Field label="Bagagem"><Input value={f.baggage || ''} onChange={e => upd({ baggage: e.target.value })} placeholder="Ex.: 1 mala 23kg" /></Field>
            </div>
            <Field label="Políticas / observações"><Textarea value={f.policies || ''} onChange={e => upd({ policies: e.target.value })} placeholder="Regras de remarcação, no-show, etc." /></Field>
          </div>
        )
      })}
    </SectionCard>
  )
}

export function HotelsSection({
  orgSlug, hotels, setHotels,
}: { orgSlug: string; hotels: any[]; setHotels: (v: any[]) => void }) {
  return (
    <SectionCard
      icon={Hotel} title="Hospedagem"
      action={
        <Button type="button" variant="outline" size="sm"
          onClick={() => setHotels([...hotels, { name: '', kind: '', room_category: '', meal_plan: '', cancellation_policy: '', briefing: '', photos: [] }])}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Hotel
        </Button>
      }
    >
      {(hotels || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hospedagem adicionada.</p>}
      {(hotels || []).map((h: any, i: number) => {
        const upd = (patch: any) => { const n = [...hotels]; n[i] = { ...n[i], ...patch }; setHotels(n) }
        return (
          <div key={i} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground">Hospedagem {i + 1}</span>
              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => setHotels(hotels.filter((_: any, j: number) => j !== i))}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome (hotel/resort/pousada)"><Input value={h.name || ''} onChange={e => upd({ name: e.target.value })} placeholder="Ex.: Resort Riu Cancún" /></Field>
              <Field label="Tipo"><Input value={h.kind || ''} onChange={e => upd({ kind: e.target.value })} placeholder="Resort / Hotel / Pousada" /></Field>
              <Field label="Categoria do quarto"><Input value={h.room_category || ''} onChange={e => upd({ room_category: e.target.value })} placeholder="Ex.: Vista mar, casal" /></Field>
              <Field label="Regime de alimentação"><Input value={h.meal_plan || ''} onChange={e => upd({ meal_plan: e.target.value })} placeholder="Ex.: All inclusive" /></Field>
            </div>
            <Field label="Política de cancelamento"><Textarea value={h.cancellation_policy || ''} onChange={e => upd({ cancellation_policy: e.target.value })} placeholder="Condições de cancelamento e reembolso" /></Field>
            <Field label="Experiência (mini briefing)"><Textarea value={h.briefing || ''} onChange={e => upd({ briefing: e.target.value })} placeholder="Descreva a experiência da hospedagem" /></Field>
            <PhotoManager
              orgSlug={orgSlug}
              label="Fotos da hospedagem"
              photos={Array.isArray(h.photos) ? h.photos : []}
              onChange={(photos) => upd({ photos })}
            />
          </div>
        )
      })}
    </SectionCard>
  )
}
