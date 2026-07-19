'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updatePackage, type ShowcaseRow } from '@/actions/travel-showcase'
import { uploadFormAsset } from '@/actions/upload'
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { SHOWCASE_CATEGORIES, youtubeEmbedUrl } from '@/lib/showcase'
import {
  ArrowLeft, Save, Plus, Trash2, Plane, Hotel, MapPin,
  CheckCircle2, XCircle, Sparkles, CreditCard, Briefcase, Video,
  Share2, Copy, ExternalLink, Upload, Loader2, Tag, FileText,
} from 'lucide-react'

// ── money helpers (reais string <-> cents) ─────────────────────────────
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
      <div className="flex flex-row items-center justify-between gap-2 px-6 pt-6 pb-3">
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h3>
        {action}
      </div>
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

function StringList({
  items, onChange, placeholder,
}: { items: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  return (
    <div className="space-y-2">
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

const PAYMENT_METHODS = [
  { key: 'pix', label: 'Pix' },
  { key: 'boleto', label: 'Boleto' },
  { key: 'cartao', label: 'Cartão' },
]

function PhotoManager({
  orgSlug, label, photos, onChange,
}: { orgSlug: string; label: string; photos: string[]; onChange: (v: string[]) => void }) {
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
      <Label className="text-xs">{label}</Label>
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

export default function ShowcaseBuilder({
  orgSlug, initial, vitrineToken,
}: {
  orgSlug: string
  initial: ShowcaseRow
  vitrineToken: string | null
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [p, setP] = useState<ShowcaseRow>({
    ...initial,
    cover_photos: initial.cover_photos || [],
    destinations: initial.destinations || [],
    flights: initial.flights || [],
    hotels: initial.hotels || [],
    services: initial.services || {},
    included: initial.included || [],
    not_included: initial.not_included || [],
    order_bumps: initial.order_bumps || [],
    payment: initial.payment || {},
  })

  const set = useCallback(<K extends keyof ShowcaseRow>(key: K, val: ShowcaseRow[K]) => {
    setP(prev => ({ ...prev, [key]: val }))
  }, [])

  const service = (key: string) => (p.services?.[key] || { enabled: false, details: '' })
  function setService(key: string, patch: any) {
    set('services', { ...p.services, [key]: { ...service(key), ...patch } })
  }

  async function handleSave() {
    setSaving(true)
    const res = await updatePackage(orgSlug, p.id, {
      title: p.title, category: p.category, youtube_url: p.youtube_url,
      briefing: p.briefing, cover_photos: p.cover_photos, is_published: p.is_published,
      start_date: p.start_date || null, end_date: p.end_date || null,
      destinations: p.destinations, flights: p.flights, hotels: p.hotels,
      services: p.services, included: p.included, not_included: p.not_included,
      order_bumps: p.order_bumps, total_cents: p.total_cents, pax_count: p.pax_count,
      price_per_person_cents: p.price_per_person_cents, payment: p.payment, notes: p.notes,
    })
    setSaving(false)
    if (res.ok) { toast.success('Pacote salvo'); router.refresh() }
    else toast.error(res.error || 'Erro ao salvar')
  }

  const bumpsTotal = (p.order_bumps || []).reduce((a: number, b: any) => a + (Number(b.price_cents) || 0), 0)
  const embed = youtubeEmbedUrl(p.youtube_url)
  const [publicUrl, setPublicUrl] = useState('')
  useEffect(() => {
    if (vitrineToken) setPublicUrl(`${window.location.origin}/v/${vitrineToken}/${p.id}`)
  }, [vitrineToken, p.id])

  return (
    <div className="space-y-5 pb-24">
      {/* Sticky toolbar */}
      <div style={{ top: -20 }} className="sticky z-20 -mx-4 sm:-mx-6 -mt-5 px-4 sm:px-6 py-3 bg-background/80   border-b flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/ofertas`}><ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar</Link>
        </Button>
        <div className="flex-1 min-w-0">
          <Input
            value={p.title || ''}
            onChange={e => set('title', e.target.value)}
            placeholder="Título do pacote"
            className="border-0 shadow-none text-lg font-semibold px-0 focus-visible:ring-0"
          />
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm">
          <Switch checked={!!p.is_published} onCheckedChange={v => set('is_published', v)} />
          <span className="text-muted-foreground">{p.is_published ? 'Publicado' : 'Oculto'}</span>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar'}
        </Button>
      </div>

      {/* Compartilhamento */}
      {vitrineToken && (
        <Card className="border-primary/20 bg-primary/[0.03]">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2 text-sm font-medium shrink-0">
              <Share2 className="w-4 h-4 text-primary" /> Link público do pacote
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
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Identificação: categoria + datas */}
      <SectionCard icon={Tag} title="Identificação e período">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Categoria (classificação na vitrine)">
            <Select value={p.category || ''} onValueChange={v => set('category', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {SHOWCASE_CATEGORIES.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Data de início">
            <Input type="date" value={p.start_date || ''} onChange={e => set('start_date', e.target.value)} />
          </Field>
          <Field label="Data de fim">
            <Input type="date" value={p.end_date || ''} onChange={e => set('end_date', e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      {/* Vídeo + imagens + briefing */}
      <SectionCard icon={Video} title="Vídeo, imagens e briefing">
        <Field label="Vídeo do YouTube (link)">
          <Input
            value={p.youtube_url || ''}
            onChange={e => set('youtube_url', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
        </Field>
        {embed && (
          <div className="aspect-video w-full max-w-md overflow-hidden rounded-lg border">
            <iframe
              src={embed}
              title="Prévia do vídeo"
              className="h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        <PhotoManager
          orgSlug={orgSlug}
          label="Imagens do pacote (capa)"
          photos={Array.isArray(p.cover_photos) ? p.cover_photos : []}
          onChange={photos => set('cover_photos', photos)}
        />
        <Field label="Briefing do pacote">
          <Textarea rows={4} value={p.briefing || ''} onChange={e => set('briefing', e.target.value)}
            placeholder="Resumo do pacote: o que é, para quem é, principais experiências..." />
        </Field>
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
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

        {/* Serviços adicionais */}
        <SectionCard icon={Briefcase} title="Serviços adicionais e translados">
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
      </div>

      {/* Voos */}
      <SectionCard
        icon={Plane} title="Voos"
        action={
          <Button type="button" variant="outline" size="sm"
            onClick={() => set('flights', [...p.flights, { airline: '', flight_number: '', origin: '', destination: '', departure_at: '', arrival_at: '', connections: '', baggage: '', policies: '' }])}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Voo
          </Button>
        }
      >
        {(p.flights || []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum voo adicionado.</p>}
        {(p.flights || []).map((f: any, i: number) => {
          const upd = (patch: any) => { const n = [...p.flights]; n[i] = { ...n[i], ...patch }; set('flights', n) }
          return (
            <div key={i} className="rounded-lg border p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Voo {i + 1}</span>
                <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => set('flights', p.flights.filter((_: any, j: number) => j !== i))}>
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
                label="Fotos da hospedagem"
                photos={Array.isArray(h.photos) ? h.photos : []}
                onChange={(photos) => upd({ photos })}
              />
            </div>
          )
        })}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
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
          <StringList items={p.included || []} onChange={v => set('included', v)} placeholder="Ex.: Aéreo ida e volta" />
        </SectionCard>

        {/* Não incluso */}
        <SectionCard icon={XCircle} title="O que não está incluso">
          <StringList items={p.not_included || []} onChange={v => set('not_included', v)} placeholder="Ex.: Passeios não citados" />
        </SectionCard>
      </div>

      {/* Pagamento */}
      <SectionCard icon={CreditCard} title="Plano de pagamento, condições e valores">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Valor total">
            <MoneyInput value={p.total_cents || 0} onChange={c => set('total_cents', c)} />
          </Field>
          <Field label="Nº de pessoas">
            <Input type="number" min="0" value={p.pax_count ?? ''} onChange={e => set('pax_count', e.target.value ? parseInt(e.target.value) : null)} placeholder="Ex.: 2" />
          </Field>
          <Field label="Valor por pessoa">
            <MoneyInput value={p.price_per_person_cents || 0} onChange={c => set('price_per_person_cents', c)} />
          </Field>
        </div>

        <Field label="Formas de pagamento aceitas">
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map(m => {
              const list: string[] = p.payment?.methods || []
              const on = list.includes(m.key)
              return (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => {
                    const next = on ? list.filter(x => x !== m.key) : [...list, m.key]
                    set('payment', { ...p.payment, methods: next })
                  }}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Condições e parcelamento">
          <Textarea
            value={p.payment?.conditions || ''}
            onChange={e => set('payment', { ...p.payment, conditions: e.target.value })}
            placeholder="Ex.: Entrada de 30% + saldo em até 10x no cartão. Pix com 5% de desconto."
          />
        </Field>
      </SectionCard>

      {/* Notas internas */}
      <SectionCard icon={FileText} title="Notas internas (não aparecem na vitrine)">
        <Textarea value={p.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Anotações internas sobre esse pacote" />
      </SectionCard>

      {/* bottom save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          <Save className="w-4 h-4 mr-1.5" /> {saving ? 'Salvando…' : 'Salvar pacote'}
        </Button>
      </div>
    </div>
  )
}
