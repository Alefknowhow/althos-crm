'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateProposal, type ProposalRow } from '@/actions/travel-proposals'
import { uploadFormAsset } from '@/actions/upload'
import { lookupFlight } from '@/actions/flight-lookup'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Save, Plus, Trash2, Plane, Hotel, MapPin, Users, CalendarRange,
  CheckCircle2, XCircle, Sparkles, CreditCard, Briefcase,
  Share2, Copy, ExternalLink, Upload, Loader2, Search,
} from 'lucide-react'

type Lead = { id: string; name: string }

// ── small money helper (reais string <-> cents) ─────────────────────────────
function centsToReais(c?: number | null) {
  return c ? String((c / 100).toFixed(2)).replace('.', ',') : ''
}
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

function MoneyInput({
  value, onChange, placeholder = 'R$ 0,00',
}: { value: number; onChange: (cents: number) => void; placeholder?: string }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }}
    />
  )
}

function SectionCard({
  icon: Icon, title, action, children,
}: { icon: any; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  )
}

// editable string list (incluso / não incluso)
function StringList({
  items, onChange, placeholder, suggestions = [],
}: { items: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[] }) {
  return (
    <div className="space-y-3">
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map(s => {
            const on = items.some(it => it.trim().toLowerCase() === s.toLowerCase())
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  onChange(on
                    ? items.filter(it => it.trim().toLowerCase() !== s.toLowerCase())
                    : [...items, s])
                }}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'}`}
              >
                {on ? <CheckCircle2 className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                {s}
              </button>
            )
          })}
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          <Input
            value={it}
            placeholder={placeholder}
            onChange={e => { const next = [...items]; next[i] = e.target.value; onChange(next) }}
          />
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => onChange(items.filter((_, j) => j !== i))}>
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
        <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar item
      </Button>
    </div>
  )
}

// Quick-add chips para acelerar o preenchimento de incluso / não incluso.
const INCLUDED_SUGGESTIONS = [
  'Aéreo ida e volta',
  'Bagagem (23kg)',
  'Bagagem de mão (10kg)',
  'Marcação de assentos',
  'Taxas e impostos',
  'Transfer aeroporto ⇄ hotel',
  'Café da manhã',
  'Seguro viagem',
  'Hospedagem',
  'Passeios mencionados',
  'Assistência 24h',
]
const NOT_INCLUDED_SUGGESTIONS = [
  'Bagagem despachada',
  'Marcação de assentos',
  'Taxas e impostos locais',
  'Transfer',
  'Passeios não citados',
  'Refeições não mencionadas',
  'Despesas pessoais',
  'Seguro viagem',
  'Gorjetas',
  'Vistos e documentação',
]

const PAYMENT_METHODS = [
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cartao', label: 'Cartão de crédito' },
]

// Hotel photo manager: upload to storage + URL list with thumbnails
function PhotoManager({
  orgSlug, photos, onChange,
}: { orgSlug: string; photos: string[]; onChange: (v: string[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState('')

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: string[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadFormAsset(orgSlug, fd)
      if (res.ok) added.push(res.url)
      else toast.error(res.error || 'Falha no upload')
    }
    setUploading(false)
    if (added.length) onChange([...photos, ...added])
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs">Fotos da hospedagem</Label>
      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((src, i) => (
            <div key={i} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-20 w-full object-cover rounded-md border" />
              <button
                type="button"
                onClick={() => onChange(photos.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 rounded-full bg-destructive text-white p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
          {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {uploading ? 'Enviando…' : 'Enviar fotos'}
          <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
            onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
        </label>
        <div className="flex gap-2 flex-1 min-w-[200px]">
          <Input placeholder="ou cole uma URL de imagem" value={url} onChange={e => setUrl(e.target.value)} />
          <Button type="button" variant="outline" size="sm"
            onClick={() => { const u = url.trim(); if (u) { onChange([...photos, u]); setUrl('') } }}>
            Adicionar
          </Button>
        </div>
      </div>
    </div>
  )
}

// Flight card: "Busca rápida" (Cia + Número + Data) on top → autofill via
// AeroDataBox; manual detail fields below. The search inputs are local state;
// only the resolved facts are persisted onto the flight object.
function FlightCard({
  orgSlug, f, index, onUpdate, onRemove,
}: {
  orgSlug: string
  f: any
  index: number
  onUpdate: (patch: any) => void
  onRemove: () => void
}) {
  const upd = onUpdate
  const [cia, setCia] = useState(f.airline || '')
  const [num, setNum] = useState(f.flight_number || '')
  const [date, setDate] = useState('')
  const [searching, setSearching] = useState(false)

  async function handleSearch() {
    if (!cia.trim() || !num.trim() || !date.trim()) {
      toast.error('Informe companhia, número do voo e data para buscar.')
      return
    }
    setSearching(true)
    try {
      const res = await lookupFlight(orgSlug, cia, num, date)
      if (!res.ok) {
        toast.error(res.error)
        return
      }
      const fl = res.flight
      upd({
        airline: fl.airline || cia,
        flight_number: fl.flight_number || num,
        origin: fl.origin,
        origin_name: fl.origin_name,
        origin_terminal: fl.origin_terminal,
        destination: fl.destination,
        destination_name: fl.destination_name,
        destination_terminal: fl.destination_terminal,
        departure_at: fl.departure_at,
        arrival_at: fl.arrival_at,
        aircraft: fl.aircraft,
      })
      if (fl.airline) setCia(fl.airline)
      if (fl.flight_number) setNum(fl.flight_number)
      toast.success(`Voo ${fl.flight_number || num} preenchido!`)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar voo.')
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="rounded-lg border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Voo {index + 1}</span>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
          onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* ── Busca rápida: preencha só isto ─────────────────────────────── */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Search className="w-3.5 h-3.5" /> Busca rápida — preencha e clique em Buscar
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
          <Field label="Companhia"><Input value={cia} onChange={e => setCia(e.target.value)} placeholder="LATAM" /></Field>
          <Field label="Número do voo"><Input value={num} onChange={e => setNum(e.target.value)} placeholder="LA1234" /></Field>
          <Field label="Data"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Button type="button" onClick={handleSearch} disabled={searching} className="w-full sm:w-auto">
            {searching ? <Loader2 className="w-4 h-4 animate-spin sm:mr-1.5" /> : <Search className="w-4 h-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">Buscar</span>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Origem, destino, horários, aeronave e terminais são preenchidos automaticamente. Ajuste o que precisar abaixo.
        </p>
      </div>

      {/* ── Detalhes (auto-preenchidos / editáveis) ───────────────────── */}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Companhia aérea"><Input value={f.airline || ''} onChange={e => upd({ airline: e.target.value })} placeholder="Ex.: LATAM" /></Field>
        <Field label="Número do voo"><Input value={f.flight_number || ''} onChange={e => upd({ flight_number: e.target.value })} placeholder="Ex.: LA1234" /></Field>
        <Field label="Origem"><Input value={f.origin || ''} onChange={e => upd({ origin: e.target.value })} placeholder="GRU" /></Field>
        <Field label="Destino"><Input value={f.destination || ''} onChange={e => upd({ destination: e.target.value })} placeholder="CUN" /></Field>
        <Field label="Terminal de embarque"><Input value={f.origin_terminal || ''} onChange={e => upd({ origin_terminal: e.target.value })} placeholder="Ex.: 3" /></Field>
        <Field label="Terminal de desembarque"><Input value={f.destination_terminal || ''} onChange={e => upd({ destination_terminal: e.target.value })} placeholder="Ex.: 2" /></Field>
        <Field label="Embarque"><Input value={f.departure_at || ''} onChange={e => upd({ departure_at: e.target.value })} placeholder="01/12 08:30" /></Field>
        <Field label="Chegada"><Input value={f.arrival_at || ''} onChange={e => upd({ arrival_at: e.target.value })} placeholder="01/12 14:10" /></Field>
        <Field label="Aeronave"><Input value={f.aircraft || ''} onChange={e => upd({ aircraft: e.target.value })} placeholder="Ex.: Airbus A320" /></Field>
        <Field label="Conexões"><Input value={f.connections || ''} onChange={e => upd({ connections: e.target.value })} placeholder="Ex.: 1 parada em PTY" /></Field>
        <Field label="Bagagem"><Input value={f.baggage || ''} onChange={e => upd({ baggage: e.target.value })} placeholder="Ex.: 1 mala 23kg" /></Field>
      </div>
      <Field label="Políticas / observações"><Textarea value={f.policies || ''} onChange={e => upd({ policies: e.target.value })} placeholder="Regras de remarcação, no-show, etc." /></Field>
    </div>
  )
}

export default function ProposalBuilder({
  orgSlug, initial, leads,
}: {
  orgSlug: string
  initial: ProposalRow
  leads: Lead[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [p, setP] = useState<ProposalRow>({
    ...initial,
    travelers: initial.travelers || [],
    destinations: initial.destinations || [],
    flights: initial.flights || [],
    hotels: initial.hotels || [],
    services: initial.services || {},
    included: initial.included || [],
    not_included: initial.not_included || [],
    order_bumps: initial.order_bumps || [],
    payment: initial.payment || {},
  })

  const set = useCallback(<K extends keyof ProposalRow>(key: K, val: ProposalRow[K]) => {
    setP(prev => ({ ...prev, [key]: val }))
  }, [])

  const service = (key: string) => (p.services?.[key] || { enabled: false, details: '' })
  function setService(key: string, patch: any) {
    set('services', { ...p.services, [key]: { ...service(key), ...patch } })
  }

  async function handleSave() {
    setSaving(true)
    const res = await updateProposal(orgSlug, p.id, {
      title: p.title, status: p.status, lead_id: p.lead_id,
      start_date: p.start_date || null, end_date: p.end_date || null,
      client_name: p.client_name, travelers: p.travelers, travelers_note: p.travelers_note,
      destinations: p.destinations, flights: p.flights, hotels: p.hotels,
      services: p.services, included: p.included, not_included: p.not_included,
      order_bumps: p.order_bumps, total_cents: p.total_cents, pax_count: p.pax_count,
      price_per_person_cents: p.price_per_person_cents, payment: p.payment, notes: p.notes,
    })
    setSaving(false)
    if (res.ok) { toast.success('Proposta salva'); router.refresh() }
    else toast.error(res.error || 'Erro ao salvar')
  }

  const bumpsTotal = (p.order_bumps || []).reduce((a: number, b: any) => a + (Number(b.price_cents) || 0), 0)
  const [publicUrl, setPublicUrl] = useState('')
  useEffect(() => {
    if (p.public_token) setPublicUrl(`${window.location.origin}/p/${p.public_token}`)
  }, [p.public_token])

  return (
    <div className="space-y-5 pb-24">
      {/* Sticky toolbar */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-background/80 backdrop-blur border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/proposta`}><ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={p.title || ''}
            onChange={e => set('title', e.target.value)}
            placeholder="Título da proposta"
            className="border-0 shadow-none text-lg font-semibold px-0 focus-visible:ring-0"
          />
        </div>
        <Select value={p.status} onValueChange={v => set('status', v)}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="sent">Enviada</SelectItem>
            <SelectItem value="accepted">Aceita</SelectItem>
            <SelectItem value="rejected">Recusada</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>

      {/* Compartilhamento */}
      {p.public_token && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium shrink-0">
              <Share2 className="w-4 h-4 text-primary" /> Link público
            </div>
            <Input
              readOnly
              value={publicUrl}
              onFocus={e => e.currentTarget.select()}
              className="font-mono text-xs"
            />
            <div className="flex gap-2 shrink-0">
              <Button type="button" variant="outline" size="sm"
                onClick={async () => {
                  try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
                  catch { toast.error('Não foi possível copiar') }
                }}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir / PDF
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Lead link + datas + cliente */}
        <SectionCard icon={Users} title="Cliente e período">
          <Field label="Vincular a um lead do pipeline">
            <Select
              value={p.lead_id || 'none'}
              onValueChange={v => set('lead_id', v === 'none' ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="Selecione um lead" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nome do cliente (exibido na proposta)">
            <Input value={p.client_name || ''} onChange={e => set('client_name', e.target.value)} placeholder="Ex.: Família Silva" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data de início">
              <Input type="date" value={p.start_date || ''} onChange={e => set('start_date', e.target.value)} />
            </Field>
            <Field label="Data de fim">
              <Input type="date" value={p.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </Field>
          </div>
          <Field label="Observação sobre os viajantes">
            <Input value={p.travelers_note || ''} onChange={e => set('travelers_note', e.target.value)} placeholder="Ex.: 2 adultos e 1 criança" />
          </Field>

          {/* travelers list */}
          <div className="space-y-2">
            <Label className="text-xs">Viajantes (nome e idade)</Label>
            {(p.travelers || []).map((t: any, i: number) => (
              <div key={i} className="flex gap-2">
                <Input className="flex-1" placeholder="Nome" value={t.name || ''}
                  onChange={e => { const n = [...p.travelers]; n[i] = { ...n[i], name: e.target.value }; set('travelers', n) }} />
                <Input className="w-24" placeholder="Idade" inputMode="numeric" value={t.age ?? ''}
                  onChange={e => { const n = [...p.travelers]; n[i] = { ...n[i], age: e.target.value }; set('travelers', n) }} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => set('travelers', p.travelers.filter((_: any, j: number) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set('travelers', [...p.travelers, { name: '', age: '' }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar viajante
            </Button>
          </div>
        </SectionCard>

        {/* Destinos */}
        <SectionCard
          icon={MapPin} title="Destinos"
          action={
            <Button type="button" variant="outline" size="sm"
              onClick={() => set('destinations', [...p.destinations, { name: '', briefing: '' }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Destino
            </Button>
          }
        >
          {(p.destinations || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum destino adicionado.</p>}
          {(p.destinations || []).map((d: any, i: number) => (
            <div key={i} className="rounded-lg border p-3 space-y-2">
              <div className="flex gap-2">
                <Input className="flex-1" placeholder="Destino (ex.: Cancún, México)" value={d.name || ''}
                  onChange={e => { const n = [...p.destinations]; n[i] = { ...n[i], name: e.target.value }; set('destinations', n) }} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => set('destinations', p.destinations.filter((_: any, j: number) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <Textarea placeholder="Mini briefing sobre o destino" value={d.briefing || ''}
                onChange={e => { const n = [...p.destinations]; n[i] = { ...n[i], briefing: e.target.value }; set('destinations', n) }} />
            </div>
          ))}
        </SectionCard>
      </div>

      {/* Voos */}
      <SectionCard
        icon={Plane} title="Voos"
        action={
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('flights', [...p.flights, { airline: '', flight_number: '', origin: '', origin_name: '', origin_terminal: '', destination: '', destination_name: '', destination_terminal: '', departure_at: '', arrival_at: '', aircraft: '', connections: '', baggage: '', policies: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Voo
          </Button>
        }
      >
        {(p.flights || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum voo adicionado.</p>}
        {(p.flights || []).map((f: any, i: number) => (
          <FlightCard
            key={i}
            orgSlug={orgSlug}
            f={f}
            index={i}
            onUpdate={(patch: any) => { const n = [...p.flights]; n[i] = { ...n[i], ...patch }; set('flights', n) }}
            onRemove={() => set('flights', p.flights.filter((_: any, j: number) => j !== i))}
          />
        ))}
      </SectionCard>

      {/* Hotéis */}
      <SectionCard
        icon={Hotel} title="Hospedagem"
        action={
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('hotels', [...p.hotels, { name: '', kind: '', room_category: '', meal_plan: '', cancellation_policy: '', briefing: '', photos: [] }])}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Hotel
          </Button>
        }
      >
        {(p.hotels || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hospedagem adicionada.</p>}
        {(p.hotels || []).map((h: any, i: number) => {
          const upd = (patch: any) => { const n = [...p.hotels]; n[i] = { ...n[i], ...patch }; set('hotels', n) }
          return (
            <div key={i} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Hospedagem {i + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => set('hotels', p.hotels.filter((_: any, j: number) => j !== i))}>
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
                photos={Array.isArray(h.photos) ? h.photos : []}
                onChange={(photos) => upd({ photos })}
              />
            </div>
          )
        })}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Serviços adicionais */}
        <SectionCard icon={Briefcase} title="Serviços adicionais">
          {[
            { key: 'transfer', label: 'Traslado' },
            { key: 'insurance', label: 'Seguro viagem' },
            { key: 'car_rental', label: 'Locação de carro' },
          ].map(s => {
            const sv = service(s.key)
            return (
              <div key={s.key} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{s.label}</Label>
                  <Switch checked={!!sv.enabled} onCheckedChange={v => setService(s.key, { enabled: v })} />
                </div>
                {sv.enabled && (
                  <Textarea placeholder={`Detalhes de ${s.label.toLowerCase()}`} value={sv.details || ''}
                    onChange={e => setService(s.key, { details: e.target.value })} />
                )}
              </div>
            )
          })}
        </SectionCard>

        {/* Order bumps */}
        <SectionCard
          icon={Sparkles} title="Opcionais (order bump)"
          action={
            <Button type="button" variant="outline" size="sm"
              onClick={() => set('order_bumps', [...p.order_bumps, { name: '', description: '', price_cents: 0 }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Opcional
            </Button>
          }
        >
          {(p.order_bumps || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum opcional adicionado.</p>}
          {(p.order_bumps || []).map((b: any, i: number) => {
            const upd = (patch: any) => { const n = [...p.order_bumps]; n[i] = { ...n[i], ...patch }; set('order_bumps', n) }
            return (
              <div key={i} className="rounded-lg border p-3 space-y-2">
                <div className="flex gap-2">
                  <Input className="flex-1" placeholder="Nome do opcional" value={b.name || ''} onChange={e => upd({ name: e.target.value })} />
                  <div className="w-32"><MoneyInput value={Number(b.price_cents) || 0} onChange={c => upd({ price_cents: c })} /></div>
                  <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                    onClick={() => set('order_bumps', p.order_bumps.filter((_: any, j: number) => j !== i))}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <Textarea placeholder="Descrição" value={b.description || ''} onChange={e => upd({ description: e.target.value })} />
              </div>
            )
          })}
          {bumpsTotal > 0 && (
            <p className="text-xs text-muted-foreground">Soma dos opcionais: <strong>{formatCurrency(bumpsTotal)}</strong></p>
          )}
        </SectionCard>

        {/* Incluso */}
        <SectionCard icon={CheckCircle2} title="O que está incluso">
          <StringList items={p.included || []} onChange={v => set('included', v)} placeholder="Ex.: Aéreo ida e volta" suggestions={INCLUDED_SUGGESTIONS} />
        </SectionCard>

        {/* Não incluso */}
        <SectionCard icon={XCircle} title="O que não está incluso">
          <StringList items={p.not_included || []} onChange={v => set('not_included', v)} placeholder="Ex.: Passeios não citados" suggestions={NOT_INCLUDED_SUGGESTIONS} />
        </SectionCard>
      </div>

      {/* Pagamento */}
      <SectionCard icon={CreditCard} title="Pagamento">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor total">
            <MoneyInput value={p.total_cents || 0} onChange={c => set('total_cents', c)} />
          </Field>
          <Field label="Nº de pessoas">
            <Input type="number" min="0" value={p.pax_count ?? ''} onChange={e => set('pax_count', e.target.value ? parseInt(e.target.value) : null)} placeholder="Ex.: 3" />
          </Field>
          <Field label="Valor por pessoa">
            <MoneyInput value={p.price_per_person_cents || 0} onChange={c => set('price_per_person_cents', c)} />
          </Field>
        </div>

        <Field label="Formas de pagamento aceitas">
          <p className="text-xs text-muted-foreground mb-2">
            Ative a forma de pagamento e descreva as condições ao lado.
          </p>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(m => {
              const list: string[] = p.payment?.methods || []
              const on = list.includes(m.key)
              const conds: Record<string, string> = p.payment?.method_conditions || {}
              return (
                <div key={m.key} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = on ? list.filter(x => x !== m.key) : [...list, m.key]
                      set('payment', { ...p.payment, methods: next })
                    }}
                    className={`shrink-0 w-40 px-3 py-2 rounded-md text-sm border transition-colors text-left flex items-center gap-2 ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                  >
                    {on ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0 opacity-50" />}
                    {m.label}
                  </button>
                  <Input
                    value={conds[m.key] || ''}
                    disabled={!on}
                    onChange={e => set('payment', { ...p.payment, method_conditions: { ...conds, [m.key]: e.target.value } })}
                    placeholder={on ? 'Ex.: até 10x sem juros · 5% de desconto' : 'Ative para descrever as condições'}
                    className="flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>
              )
            })}
          </div>
        </Field>
      </SectionCard>

      {/* Notas internas */}
      <SectionCard icon={CalendarRange} title="Notas internas (não aparecem na proposta)">
        <Textarea value={p.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Anotações internas sobre essa proposta" />
      </SectionCard>

      {/* bottom save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar proposta'}
        </Button>
      </div>
    </div>
  )
}
