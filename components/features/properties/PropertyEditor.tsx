'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Loader2, Trash2, X } from 'lucide-react'
import {
  updateProperty, archiveProperty, addPropertyMedia, removePropertyMedia, setCoverMedia,
  type PropertyRow, type PropertyMediaRow,
} from '@/actions/properties'
import { uploadSaleVoucher } from '@/actions/upload'
import { PropertyEditorMedia } from './PropertyEditorMedia'
import PropertyInterestsSection from './PropertyInterestsSection'
import PropertyVisitsSection from './PropertyVisitsSection'
import PropertyProposalsView from './PropertyProposalsView'
import type { PropertyInterestRow } from '@/actions/property-interests'
import type { PropertyVisitRow } from '@/actions/property-visits'
import type { PropertyProposalRow } from '@/actions/property-proposals'

type Contato = { id: string; name: string; phone: string | null }
type Member = { user_id: string; name: string; email: string }

const STATUS_OPTIONS = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'em_negociacao', label: 'Em negociação' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'alugado', label: 'Alugado' },
  { value: 'indisponivel', label: 'Indisponível' },
]
const PURPOSE_OPTIONS = [
  { value: 'venda', label: 'Venda' },
  { value: 'locacao', label: 'Locação' },
  { value: 'venda_locacao', label: 'Venda + Locação' },
]
const TYPE_SUGGESTIONS = ['Apartamento', 'Casa', 'Sobrado', 'Terreno', 'Sala comercial', 'Loja', 'Galpão', 'Cobertura', 'Sítio', 'Fazenda', 'Condomínio', 'Imóvel comercial']
const FEATURE_SUGGESTIONS = ['Piscina', 'Churrasqueira', 'Varanda', 'Elevador', 'Mobiliado', 'Ar-condicionado', 'Academia', 'Condomínio fechado', 'Portaria 24h', 'Segurança']

function centsToStr(c?: number | null) { return c ? (c / 100).toFixed(2).replace('.', ',') : '' }
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null
}

function F({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

export default function PropertyEditor({
  orgSlug, property, media: initialMedia, contatos, members, interests = [], visits = [], proposals = [],
}: {
  orgSlug: string; property: PropertyRow; media: PropertyMediaRow[]; contatos: Contato[]; members: Member[]
  interests?: PropertyInterestRow[]; visits?: PropertyVisitRow[]; proposals?: PropertyProposalRow[]
}) {
  const router = useRouter()
  const [p, setP] = useState(property)
  const [media, setMedia] = useState(initialMedia)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [uploading, setUploading] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)

  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaveState('saving')
    const timer = setTimeout(async () => {
      const {
        id: _id, organization_id: _oid, code: _code, created_by: _cb, created_at: _ca, updated_at: _ua, ...input
      } = p
      const res = await updateProperty(orgSlug, p.id, input)
      if (res.ok) setSaveState('saved')
      else { setSaveState('error'); toast.error(res.error || 'Erro ao salvar') }
    }, 800)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p)])

  const set = useCallback(<K extends keyof PropertyRow>(key: K, value: PropertyRow[K]) => {
    setP(s => ({ ...s, [key]: value }))
  }, [])

  async function handleUpload(files: FileList | null, mediaType: 'photo' | 'document') {
    if (!files || files.length === 0) return
    setUploading(true)
    const added: { storage_key: string; media_type: 'photo' | 'document'; label?: string | null }[] = []
    for (const file of Array.from(files).slice(0, 10)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSaleVoucher(orgSlug, fd)
      if (res.ok) added.push({ storage_key: res.url, media_type: mediaType, label: mediaType === 'document' ? res.name : null })
      else toast.error(res.error)
    }
    if (added.length > 0) {
      const res = await addPropertyMedia(orgSlug, p.id, added)
      if (res.ok) router.refresh()
      // otimista: reflete localmente sem esperar o refresh do server component
      setMedia(m => [...m, ...added.map((a, i) => ({
        id: `tmp-${Date.now()}-${i}`, property_id: p.id, storage_key: a.storage_key,
        media_type: a.media_type, label: a.label ?? null, sort_order: m.length + i, is_cover: false,
      }))])
    }
    setUploading(false)
  }

  async function handleRemoveMedia(id: string) {
    setMedia(m => m.filter(x => x.id !== id))
    await removePropertyMedia(orgSlug, id)
  }

  async function handleSetCover(id: string) {
    setMedia(m => m.map(x => ({ ...x, is_cover: x.id === id })))
    await setCoverMedia(orgSlug, p.id, id)
  }

  async function handleArchive() {
    if (!window.confirm('Marcar este imóvel como indisponível?')) return
    const res = await archiveProperty(orgSlug, p.id)
    if (res.ok) { toast.success('Imóvel arquivado'); router.push(`/app/${orgSlug}/imoveis`) }
    else toast.error(res.error)
  }

  const photos = media.filter(m => m.media_type === 'photo')
  const documents = media.filter(m => m.media_type === 'document')
  const features = p.features || []

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-4xl mx-auto pb-24">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push(`/app/${orgSlug}/imoveis`)}>
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Imóveis
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {saveState === 'saving' && <span className="flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Salvando…</span>}
            {saveState === 'saved' && 'Salvo'}
            {saveState === 'error' && <span className="text-destructive">Erro ao salvar</span>}
          </span>
          <Button variant="outline" size="sm" onClick={handleArchive}><Trash2 className="w-3.5 h-3.5 mr-1.5" /> Arquivar</Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
      </div>

      {/* Informações principais */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Informações principais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <F label="Título"><Input value={p.title} onChange={e => set('title', e.target.value)} placeholder="Ex.: Apartamento 3 quartos com vista mar" /></F>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Tipo">
              <Input list="property-types" value={p.property_type || ''} onChange={e => set('property_type', e.target.value)} placeholder="Apartamento" />
              <datalist id="property-types">{TYPE_SUGGESTIONS.map(t => <option key={t} value={t} />)}</datalist>
            </F>
            <F label="Finalidade">
              <Select value={p.purpose} onValueChange={v => set('purpose', v as PropertyRow['purpose'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PURPOSE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Status">
              <Select value={p.status} onValueChange={v => set('status', v as PropertyRow['status'])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <F label="Preço (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(p.price_cents)} onChange={e => set('price_cents', strToCents(e.target.value))} /></F>
            <F label="Condomínio (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(p.condo_fee_cents)} onChange={e => set('condo_fee_cents', strToCents(e.target.value))} /></F>
            <F label="IPTU (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(p.iptu_cents)} onChange={e => set('iptu_cents', strToCents(e.target.value))} /></F>
          </div>
          <F label="Descrição"><Textarea rows={4} value={p.description_html || ''} onChange={e => set('description_html', e.target.value)} placeholder="Descreva o imóvel…" /></F>
        </CardContent>
      </Card>

      {/* Características */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Características</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <F label="Dormitórios"><Input type="number" min={0} value={p.bedrooms ?? ''} onChange={e => set('bedrooms', e.target.value ? parseInt(e.target.value) : null)} /></F>
            <F label="Suítes"><Input type="number" min={0} value={p.suites ?? ''} onChange={e => set('suites', e.target.value ? parseInt(e.target.value) : null)} /></F>
            <F label="Banheiros"><Input type="number" min={0} value={p.bathrooms ?? ''} onChange={e => set('bathrooms', e.target.value ? parseInt(e.target.value) : null)} /></F>
            <F label="Vagas"><Input type="number" min={0} value={p.parking_spots ?? ''} onChange={e => set('parking_spots', e.target.value ? parseInt(e.target.value) : null)} /></F>
            <F label="Ambientes"><Input type="number" min={0} value={p.rooms_count ?? ''} onChange={e => set('rooms_count', e.target.value ? parseInt(e.target.value) : null)} /></F>
            <F label="Andar"><Input value={p.floor || ''} onChange={e => set('floor', e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <F label="Área construída (m²)"><Input type="number" min={0} value={p.area_built ?? ''} onChange={e => set('area_built', e.target.value ? parseFloat(e.target.value) : null)} /></F>
            <F label="Área total (m²)"><Input type="number" min={0} value={p.area_total ?? ''} onChange={e => set('area_total', e.target.value ? parseFloat(e.target.value) : null)} /></F>
            <F label="Área útil (m²)"><Input type="number" min={0} value={p.area_useful ?? ''} onChange={e => set('area_useful', e.target.value ? parseFloat(e.target.value) : null)} /></F>
          </div>
          <F label="Comodidades">
            <div className="flex flex-wrap gap-1.5">
              {FEATURE_SUGGESTIONS.map(f => {
                const active = features.includes(f)
                return (
                  <button key={f} type="button"
                    onClick={() => set('features', active ? features.filter(x => x !== f) : [...features, f])}
                    className={`px-2.5 py-1 rounded-full border text-xs transition-colors ${active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'}`}>
                    {f}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-1.5 mt-2">
              <Input placeholder="Outra característica…" onKeyDown={e => {
                const val = (e.target as HTMLInputElement).value.trim()
                if (e.key === 'Enter' && val && !features.includes(val)) {
                  e.preventDefault()
                  set('features', [...features, val])
                  ;(e.target as HTMLInputElement).value = ''
                }
              }} />
            </div>
            {features.filter(f => !FEATURE_SUGGESTIONS.includes(f)).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {features.filter(f => !FEATURE_SUGGESTIONS.includes(f)).map(f => (
                  <span key={f} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs bg-primary text-primary-foreground border-primary">
                    {f} <button type="button" onClick={() => set('features', features.filter(x => x !== f))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </F>
        </CardContent>
      </Card>

      {/* Localização */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Localização</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <F label="Endereço" className="col-span-2"><Input value={p.address_street || ''} onChange={e => set('address_street', e.target.value)} /></F>
            <F label="Número"><Input value={p.address_number || ''} onChange={e => set('address_number', e.target.value)} /></F>
            <F label="Complemento"><Input value={p.address_complement || ''} onChange={e => set('address_complement', e.target.value)} /></F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <F label="Bairro"><Input value={p.neighborhood || ''} onChange={e => set('neighborhood', e.target.value)} /></F>
            <F label="Cidade"><Input value={p.city || ''} onChange={e => set('city', e.target.value)} /></F>
            <F label="Estado (UF)"><Input maxLength={2} value={p.state || ''} onChange={e => set('state', e.target.value.toUpperCase())} /></F>
            <F label="CEP"><Input value={p.zip || ''} onChange={e => set('zip', e.target.value)} /></F>
          </div>
        </CardContent>
      </Card>

      {/* Proprietário / Responsável */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Proprietário e responsável</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <F label="Proprietário (contato)">
              <Select value={p.owner_contato_id || 'none'} onValueChange={v => set('owner_contato_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {contatos.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Corretor responsável">
              <Select value={p.broker_user_id || 'none'} onValueChange={v => set('broker_user_id', v === 'none' ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Sem responsável" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem responsável</SelectItem>
                  {members.map(m => <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 items-end">
            <F label="Origem da captação"><Input value={p.capture_source || ''} onChange={e => set('capture_source', e.target.value)} placeholder="Indicação, prospecção…" /></F>
            <F label="Comissão (%)"><Input type="number" min={0} max={100} step={0.1} value={p.commission_percent ?? ''} onChange={e => set('commission_percent', e.target.value ? parseFloat(e.target.value) : null)} /></F>
            <label className="flex items-center gap-2 text-xs font-medium h-9">
              <Switch checked={p.is_exclusive} onCheckedChange={v => set('is_exclusive', v)} /> Captação exclusiva
            </label>
          </div>
          {p.is_exclusive && (
            <F label="Exclusividade até"><Input type="date" value={p.exclusivity_until || ''} onChange={e => set('exclusivity_until', e.target.value || null)} className="w-48" /></F>
          )}
          <F label="Observações internas"><Textarea rows={2} value={p.internal_notes || ''} onChange={e => set('internal_notes', e.target.value)} /></F>
        </CardContent>
      </Card>

      {/* Mídia */}
      <PropertyEditorMedia
        photos={photos}
        documents={documents}
        uploading={uploading}
        photoInputRef={photoInputRef}
        docInputRef={docInputRef}
        onUpload={handleUpload}
        onRemoveMedia={handleRemoveMedia}
        onSetCover={handleSetCover}
      />

      <PropertyInterestsSection orgSlug={orgSlug} mode={{ type: 'property', propertyId: p.id }} initial={interests} contatos={contatos} />
      <PropertyVisitsSection orgSlug={orgSlug} mode={{ type: 'property', propertyId: p.id }} initial={visits} contatos={contatos} members={members} />

      <Card>
        <CardContent className="pt-6">
          <PropertyProposalsView orgSlug={orgSlug} proposals={proposals} properties={[]} contatos={contatos} fixedPropertyId={p.id} />
        </CardContent>
      </Card>
    </div>
  )
}
