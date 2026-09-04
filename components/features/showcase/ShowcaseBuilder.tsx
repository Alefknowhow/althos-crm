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
import { toast } from 'sonner'
import { formatCurrency } from '@/lib/utils'
import { SHOWCASE_CATEGORIES, youtubeEmbedUrl } from '@/lib/showcase'
import {
  ArrowLeft, Save, Plus, Trash2,
  CheckCircle2, XCircle, Sparkles, CreditCard, Briefcase, Video,
  Share2, Copy, ExternalLink, Tag, FileText,
} from 'lucide-react'
import { MoneyInput, SectionCard, Field, StringList, PhotoManager, PAYMENT_METHODS } from './ShowcaseBuilderShared'
import { FlightsSection, HotelsSection, DestinationsSection } from './ShowcaseBuilderFlightsHotels'

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
        <DestinationsSection destinations={p.destinations} setDestinations={v => set('destinations', v)} />

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
      <FlightsSection flights={p.flights} setFlights={v => set('flights', v)} />

      {/* Hotéis */}
      <HotelsSection orgSlug={orgSlug} hotels={p.hotels} setHotels={v => set('hotels', v)} />

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
