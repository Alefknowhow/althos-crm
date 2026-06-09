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
  ChevronDown, Clock, ArrowRight, Backpack, Luggage, ListChecks,
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

// Horários de check-in/check-out (selects). Pré-definidos em 15:00 / 12:00.
const TIME_OPTIONS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`)

// Checklist de documentos/exigências do viajante (visto, vacinas, autorizações
// de entrada). Mesma mecânica de "O que está incluso": chips + itens livres.
const CHECKLIST_SUGGESTIONS = [
  'Passaporte com validade mínima de 6 meses',
  'Visto',
  'RG atualizado',
  'Comprovante de Vacina - Febre Amarela',
  'ETA - London',
  'ETIAS - Europa (Espaço Schengen)',
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
  const [dragOver, setDragOver] = useState(false)

  async function handleFiles(files: FileList | File[] | null) {
    const list = files ? Array.from(files).filter(f => f.type.startsWith('image/')) : []
    if (list.length === 0) return
    setUploading(true)
    const added: string[] = []
    for (const file of list) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadFormAsset(orgSlug, fd)
      if (res.ok) added.push(res.url)
      else toast.error(res.error || 'Falha no upload')
    }
    setUploading(false)
    if (added.length) onChange([...photos, ...added])
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (files && files.length) { handleFiles(files); return }
    // Arrastar uma imagem de outra aba normalmente entrega uma URL.
    const dropped = e.dataTransfer?.getData('text')?.trim()
    if (dropped && /^https?:\/\//.test(dropped)) onChange([...photos, dropped])
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items ? Array.from(e.clipboardData.items) : []
    const imgs = items.filter(it => it.type.startsWith('image/')).map(it => it.getAsFile()).filter(Boolean) as File[]
    if (imgs.length) { e.preventDefault(); handleFiles(imgs) }
    // Se não houver imagem, deixa o paste de texto seguir normal (campo URL).
  }

  return (
    <div className="space-y-2" onPaste={handlePaste}>
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
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`rounded-lg border-2 border-dashed p-3 transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}`}
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-[11px] text-muted-foreground">
            Arraste imagens para cá, cole (Ctrl+V) ou envie do computador.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm hover:bg-muted">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {uploading ? 'Enviando…' : 'Enviar fotos'}
              <input type="file" accept="image/*" multiple className="hidden" disabled={uploading}
                onChange={e => { handleFiles(e.target.files); e.target.value = '' }} />
            </label>
          </div>
          <div className="flex gap-2 w-full max-w-sm">
            <Input placeholder="ou cole uma URL de imagem" value={url} onChange={e => setUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); const u = url.trim(); if (u) { onChange([...photos, u]); setUrl('') } } }} />
            <Button type="button" variant="outline" size="sm"
              onClick={() => { const u = url.trim(); if (u) { onChange([...photos, u]); setUrl('') } }}>
              Adicionar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Voos: modelo de "jornada" ───────────────────────────────────────────────
// 1 card = 1 jornada (Voo de ida / Trecho interno / Voo de volta), com 1+
// trechos (legs). Conexões viram trechos do MESMO card; a escala e os tempos
// são calculados a partir dos horários UTC devolvidos pela API.
const CABIN_CLASSES = ['Econômica', 'Econômica Premium', 'Executiva', 'Primeira']

// Bagagem: chips de seleção (multi) com ícones. O texto salvo em j.baggage é a
// junção dos rótulos selecionados (compatível com a visualização pública, que
// só lê a string).
const BAGGAGE_OPTIONS: { label: string; icon: any }[] = [
  { label: 'Item pessoal', icon: Backpack },
  { label: 'Mala de mão (10kg)', icon: Briefcase },
  { label: '1 mala de 23kg', icon: Luggage },
]
function parseBaggage(s?: string): string[] {
  return (s || '').split('+').map(x => x.trim()).filter(Boolean)
}
function toggleBaggage(current: string, label: string): string {
  const set = parseBaggage(current)
  const has = set.some(x => x.toLowerCase() === label.toLowerCase())
  const next = has ? set.filter(x => x.toLowerCase() !== label.toLowerCase()) : [...set, label]
  // mantém a ordem canônica das opções; itens livres antigos vão ao fim
  const ordered = [
    ...BAGGAGE_OPTIONS.map(o => o.label).filter(l => next.some(n => n.toLowerCase() === l.toLowerCase())),
    ...next.filter(n => !BAGGAGE_OPTIONS.some(o => o.label.toLowerCase() === n.toLowerCase())),
  ]
  return ordered.join(' + ')
}

function fmtMins(min: number): string {
  if (!min || min <= 0) return ''
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h && m) return `${h}h ${m}min`
  if (h) return `${h}h`
  return `${m}min`
}

function minsBetween(aIso?: string, bIso?: string): number {
  if (!aIso || !bIso) return 0
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return 0
  return Math.round((b - a) / 60000)
}

function defaultJourneyLabel(index: number): string {
  return index === 0 ? 'Voo de ida' : 'Voo de volta'
}

function emptyLeg() {
  return {
    airline: '', flight_number: '', origin: '', origin_name: '', origin_terminal: '',
    destination: '', destination_name: '', destination_terminal: '',
    departure_at: '', arrival_at: '', departure_utc: '', arrival_utc: '',
    duration_min: 0, aircraft: '',
  }
}

// Trecho (leg) a partir do resultado da API.
function legFromLookup(fl: any) {
  return { ...emptyLeg(), ...{
    airline: fl.airline || '',
    flight_number: fl.flight_number || '',
    origin: fl.origin || '',
    origin_name: fl.origin_name || '',
    origin_terminal: fl.origin_terminal || '',
    destination: fl.destination || '',
    destination_name: fl.destination_name || '',
    destination_terminal: fl.destination_terminal || '',
    departure_at: fl.departure_at || '',
    arrival_at: fl.arrival_at || '',
    departure_utc: fl.departure_utc || '',
    arrival_utc: fl.arrival_utc || '',
    duration_min: fl.duration_min || 0,
    aircraft: fl.aircraft || '',
  } }
}

// Aceita o formato antigo (voo plano) OU o novo (jornada com legs) e devolve
// sempre uma jornada — assim builder e visualização tratam de um jeito só.
function toJourney(f: any, index: number) {
  if (f && Array.isArray(f.legs)) {
    return {
      label: f.label || defaultJourneyLabel(index),
      cabin_class: f.cabin_class || '',
      legs: f.legs.map((l: any) => ({ ...emptyLeg(), ...l })),
      baggage: f.baggage || '',
      policies: f.policies || '',
    }
  }
  const hasData = f && (f.origin || f.destination || f.flight_number || f.airline)
  return {
    label: f?.label || defaultJourneyLabel(index),
    cabin_class: f?.cabin_class || '',
    legs: hasData ? [{
      ...emptyLeg(),
      airline: f.airline || '', flight_number: f.flight_number || '',
      origin: f.origin || '', origin_name: f.origin_name || '', origin_terminal: f.origin_terminal || '',
      destination: f.destination || '', destination_name: f.destination_name || '', destination_terminal: f.destination_terminal || '',
      departure_at: f.departure_at || '', arrival_at: f.arrival_at || '', aircraft: f.aircraft || '',
    }] : [],
    baggage: f?.baggage || '',
    policies: f?.policies || '',
  }
}

function normalizeFlights(flights: any[]): any[] {
  return (Array.isArray(flights) ? flights : []).map((f, i) => toJourney(f, i))
}

// Card de jornada: rótulo editável (Voo de ida / Trecho interno / Voo de volta)
// + classe. Você adiciona trechos digitando só "número do voo + data"; conexões
// entram no mesmo card e a escala/tempo total saem calculados. Detalhes ficam
// recolhidos por padrão para a tela respirar.
function JourneyCard({
  orgSlug, j, index, onUpdate, onRemove,
}: {
  orgSlug: string
  j: any
  index: number
  onUpdate: (patch: any) => void
  onRemove: () => void
}) {
  const legs: any[] = Array.isArray(j.legs) ? j.legs : []
  const [num, setNum] = useState('')
  const [date, setDate] = useState('')
  const [searching, setSearching] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  async function addLeg() {
    if (!num.trim() || !date.trim()) {
      toast.error('Informe o número do voo (ex.: LA3302) e a data.')
      return
    }
    setSearching(true)
    try {
      // A companhia já vem no número (LA3302 → LATAM); por isso passamos ''.
      const res = await lookupFlight(orgSlug, '', num, date)
      if (!res.ok) { toast.error(res.error); return }
      onUpdate({ legs: [...legs, legFromLookup(res.flight)] })
      setNum('')
      toast.success(`Trecho ${res.flight.flight_number || ''} adicionado!`)
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao buscar voo.')
    } finally {
      setSearching(false)
    }
  }

  const updateLeg = (k: number, patch: any) =>
    onUpdate({ legs: legs.map((l, i) => (i === k ? { ...l, ...patch } : l)) })
  const removeLeg = (k: number) => onUpdate({ legs: legs.filter((_, i) => i !== k) })
  const addEmptyLeg = () => { onUpdate({ legs: [...legs, emptyLeg()] }); setShowDetails(true) }

  const airMin = legs.reduce((s, l) => s + (Number(l.duration_min) || 0), 0)
  const totalMin = legs.length >= 1
    ? minsBetween(legs[0].departure_utc, legs[legs.length - 1].arrival_utc)
    : 0
  const stops = Math.max(0, legs.length - 1)

  return (
    <div className="rounded-lg border p-3 space-y-3">
      {/* Cabeçalho: rótulo editável + classe + remover */}
      <div className="flex items-center gap-2">
        <Plane className="w-4 h-4 text-primary shrink-0" />
        <Input
          value={j.label || ''}
          onChange={e => onUpdate({ label: e.target.value })}
          placeholder={defaultJourneyLabel(index)}
          className="h-8 flex-1 min-w-0 font-semibold border-0 shadow-none px-0 focus-visible:ring-0"
        />
        <Select value={j.cabin_class || ''} onValueChange={v => onUpdate({ cabin_class: v })}>
          <SelectTrigger className="h-8 w-[148px] shrink-0"><SelectValue placeholder="Classe" /></SelectTrigger>
          <SelectContent>
            {CABIN_CLASSES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10" onClick={onRemove}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Trechos adicionados (com chip de conexão entre eles) */}
      {legs.length > 0 && (
        <div className="space-y-1.5">
          {legs.map((l, k) => {
            const layover = k > 0 ? minsBetween(legs[k - 1].arrival_utc, l.departure_utc) : 0
            const connAirport = k > 0 ? (legs[k - 1].destination || l.origin) : ''
            return (
              <div key={k} className="space-y-1.5">
                {k > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-500 pl-1">
                    <Clock className="w-3 h-3" />
                    Conexão em {connAirport || '—'}{layover > 0 ? ` · ${fmtMins(layover)} de espera` : ''}
                  </div>
                )}
                <div className="flex items-center gap-2 rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
                  <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold">{l.origin || '—'}</span>
                    {l.departure_at && <span className="text-xs text-muted-foreground">{l.departure_at}</span>}
                    <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                    <span className="font-semibold">{l.destination || '—'}</span>
                    {l.arrival_at && <span className="text-xs text-muted-foreground">{l.arrival_at}</span>}
                    {(l.airline || l.flight_number) && (
                      <span className="text-xs text-muted-foreground">· {[l.airline, l.flight_number].filter(Boolean).join(' ')}</span>
                    )}
                    {Number(l.duration_min) > 0 && <span className="text-xs text-muted-foreground">· {fmtMins(l.duration_min)}</span>}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:bg-destructive/10" onClick={() => removeLeg(k)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Adicionar trecho via busca (só número + data) */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <Field label="Número do voo">
            <Input value={num} onChange={e => setNum(e.target.value)} placeholder="LA3302"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addLeg() } }} />
          </Field>
          <Field label="Data"><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></Field>
          <Button type="button" onClick={addLeg} disabled={searching} className="w-full sm:w-auto">
            {searching ? <Loader2 className="w-4 h-4 animate-spin sm:mr-1.5" /> : <Plus className="w-4 h-4 sm:mr-1.5" />}
            <span className="hidden sm:inline">{legs.length === 0 ? 'Buscar voo' : 'Add trecho'}</span>
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Digite o número com a sigla da companhia (ex.: <strong>LA3302</strong>) e a data. Para conexões, adicione um trecho de cada vez — a escala é calculada sozinha.
        </p>
      </div>

      {/* Resumo da jornada */}
      {legs.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {totalMin > 0 && <span>Duração total: <strong className="text-foreground">{fmtMins(totalMin)}</strong></span>}
          {airMin > 0 && <span>· Tempo de voo: {fmtMins(airMin)}</span>}
          <span>· {stops === 0 ? 'Voo direto' : `${stops} ${stops > 1 ? 'conexões' : 'conexão'}`}</span>
        </div>
      )}

      {/* Detalhes / ajuste manual (recolhido) */}
      <button type="button" onClick={() => setShowDetails(s => !s)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
        {showDetails ? 'Ocultar detalhes' : 'Ajustar detalhes / bagagem'}
      </button>

      {showDetails && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          {legs.map((l, k) => (
            <div key={k} className="space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground">Trecho {k + 1}</div>
              {/* Campos curtos ficam estreitos; nomes/descritivos ocupam mais. */}
              <div className="flex flex-wrap gap-2">
                <Field label="Companhia"><Input value={l.airline || ''} onChange={e => updateLeg(k, { airline: e.target.value })} placeholder="LATAM" className="w-32" /></Field>
                <Field label="Nº do voo"><Input value={l.flight_number || ''} onChange={e => updateLeg(k, { flight_number: e.target.value })} placeholder="LA3302" className="w-24" /></Field>
                <Field label="Origem"><Input value={l.origin || ''} onChange={e => updateLeg(k, { origin: e.target.value.toUpperCase() })} placeholder="GRU" maxLength={4} className="w-16 uppercase" /></Field>
                <Field label="Destino"><Input value={l.destination || ''} onChange={e => updateLeg(k, { destination: e.target.value.toUpperCase() })} placeholder="JFK" maxLength={4} className="w-16 uppercase" /></Field>
                <Field label="Term. emb."><Input value={l.origin_terminal || ''} onChange={e => updateLeg(k, { origin_terminal: e.target.value })} placeholder="3" className="w-16" /></Field>
                <Field label="Term. des."><Input value={l.destination_terminal || ''} onChange={e => updateLeg(k, { destination_terminal: e.target.value })} placeholder="4" className="w-16" /></Field>
                <Field label="Embarque"><Input value={l.departure_at || ''} onChange={e => updateLeg(k, { departure_at: e.target.value })} placeholder="01/12 22:10" className="w-28" /></Field>
                <Field label="Chegada"><Input value={l.arrival_at || ''} onChange={e => updateLeg(k, { arrival_at: e.target.value })} placeholder="02/12 06:30" className="w-28" /></Field>
                <Field label="Aeronave"><Input value={l.aircraft || ''} onChange={e => updateLeg(k, { aircraft: e.target.value })} placeholder="Boeing 777" className="w-32" /></Field>
              </div>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={addEmptyLeg}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Trecho manual
          </Button>
          <Field label="Bagagem">
            <div className="flex flex-wrap gap-1.5">
              {BAGGAGE_OPTIONS.map(opt => {
                const on = parseBaggage(j.baggage).some(x => x.toLowerCase() === opt.label.toLowerCase())
                const Icon = opt.icon
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => onUpdate({ baggage: toggleBaggage(j.baggage || '', opt.label) })}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted text-muted-foreground'}`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </Field>
          <Field label="Políticas / observações"><Textarea value={j.policies || ''} onChange={e => onUpdate({ policies: e.target.value })} placeholder="Regras de remarcação, no-show, etc." /></Field>
        </div>
      )}
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
    flights: normalizeFlights(initial.flights as any),
    hotels: initial.hotels || [],
    services: initial.services || {},
    included: initial.included || [],
    not_included: initial.not_included || [],
    checklist: initial.checklist || [],
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
      checklist: p.checklist,
      order_bumps: p.order_bumps, total_cents: p.total_cents, pax_count: p.pax_count,
      price_per_person_cents: p.price_per_person_cents, payment: p.payment, notes: p.notes,
    })
    setSaving(false)
    if (res.ok) { toast.success('Proposta salva'); router.refresh() }
    else toast.error(res.error || 'Erro ao salvar')
  }

  const bumpsTotal = (p.order_bumps || []).reduce((a: number, b: any) => a + (Number(b.price_cents) || 0), 0)

  // Valor por pessoa é derivado: valor total ÷ nº de pessoas. Mantemos o campo
  // persistido em sincronia para o link público (que lê price_per_person_cents).
  const perPersonCents = p.pax_count && p.pax_count > 0
    ? Math.round((p.total_cents || 0) / p.pax_count)
    : 0
  useEffect(() => {
    setP(prev => (prev.price_per_person_cents === perPersonCents ? prev : { ...prev, price_per_person_cents: perPersonCents }))
  }, [perPersonCents])
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

      {/* Voos + Hospedagem lado a lado (cada um em meia tela) */}
      <div className="grid gap-5 lg:grid-cols-2 items-start">
      {/* Voos */}
      <SectionCard icon={Plane} title="Voos">
        {(p.flights || []).length === 0 && (
          <p className="text-sm text-muted-foreground">
            Nenhum voo adicionado. Crie uma jornada (ida, volta ou trecho interno) e adicione os voos pelo número.
          </p>
        )}
        {(p.flights || []).map((f: any, i: number) => (
          <JourneyCard
            key={i}
            orgSlug={orgSlug}
            j={f}
            index={i}
            onUpdate={(patch: any) => { const n = [...p.flights]; n[i] = { ...n[i], ...patch }; set('flights', n) }}
            onRemove={() => set('flights', p.flights.filter((_: any, j: number) => j !== i))}
          />
        ))}
        <div className="flex flex-wrap gap-2 pt-1">
          {[
            { label: 'Voo de ida', icon: '✈' },
            { label: 'Trecho interno', icon: '⇄' },
            { label: 'Voo de volta', icon: '✈' },
          ].map(opt => (
            <Button key={opt.label} type="button" variant="outline" size="sm"
              onClick={() => set('flights', [...(p.flights || []), { label: opt.label, cabin_class: '', legs: [], baggage: '', policies: '' }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> {opt.label}
            </Button>
          ))}
        </div>
      </SectionCard>

      {/* Hotéis */}
      <SectionCard
        icon={Hotel} title="Hospedagem"
        action={
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('hotels', [...p.hotels, { name: '', kind: '', room_category: '', meal_plan: '', checkin_time: '15:00', checkout_time: '12:00', cancellation_policy: '', briefing: '', photos: [] }])}>
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Check-in">
                  <Select value={h.checkin_time || '15:00'} onValueChange={v => upd({ checkin_time: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="Check-out">
                  <Select value={h.checkout_time || '12:00'} onValueChange={v => upd({ checkout_time: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIME_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
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
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Serviços adicionais */}
        <SectionCard icon={Briefcase} title="Serviços inclusos">
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

      {/* Checklist de documentos / exigências */}
      <SectionCard icon={ListChecks} title="Checklist do viajante (documentos e exigências)">
        <p className="text-xs text-muted-foreground">
          Itens que o viajante precisa providenciar antes da viagem (documentos, vistos, vacinas). Clique nas sugestões ou adicione os seus.
        </p>
        <StringList items={p.checklist || []} onChange={v => set('checklist', v)} placeholder="Ex.: Visto americano (B1/B2)" suggestions={CHECKLIST_SUGGESTIONS} />
      </SectionCard>

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
            <div className="flex h-10 items-center rounded-md border border-input bg-muted px-3 text-sm">
              {p.pax_count && p.pax_count > 0 ? formatCurrency(perPersonCents) : '—'}
            </div>
            <p className="text-[11px] text-muted-foreground">Calculado: valor total ÷ nº de pessoas.</p>
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
