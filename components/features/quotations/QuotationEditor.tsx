'use client'

/**
 * Editor da Cotação reformulada — split view com paridade total:
 * coluna esquerda = blocos de formulário (1:1 com a entrega),
 * coluna direita = preview ao vivo do MESMO componente da rota pública.
 *
 * Autosave com debounce (~800ms). Repeaters reordenáveis via dnd-kit.
 * Imagens: upload/colar/arrastar com compressão client-side.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ArrowLeft, Plus, Trash2, GripVertical, Upload, Loader2, Copy, ExternalLink,
  CheckCircle2, Link2, Image as ImageIcon, Search, Bold, Italic, List, ListOrdered,
  Link as LinkIcon, MapPin, Plane, BedDouble, Route, AlertTriangle, Wallet,
  Sparkles, FileText, Map as MapIcon, MessageCircle, Settings2, LocateFixed,
  ChevronLeft, ChevronRight, Eye, Pencil, ShoppingBag,
} from 'lucide-react'

import { saveQuotation, generateQuotationLink, tripadvisorLookup, createSaleFromQuotation, type QuotationFull } from '@/actions/quotations'
import { geocodePlace } from '@/actions/travel-proposals'
import { uploadFormAsset } from '@/actions/upload'
import PublicQuotationView, { type PublicQuotation, BAGGAGE_OPTIONS, CABIN_LABELS } from './PublicQuotationView'

const INCLUDED_SUGGESTIONS = [
  'Aéreo ida e volta', 'Bagagem (23kg)', 'Bagagem de mão (10kg)', 'Marcação de assentos',
  'Taxas e impostos', 'Transfer aeroporto ⇄ hotel', 'Café da manhã', 'Seguro viagem',
  'Hospedagem', 'Passeios mencionados', 'Assistência 24h',
]
const NOT_INCLUDED_SUGGESTIONS = [
  'Bagagem despachada', 'Marcação de assentos', 'Taxas e impostos locais', 'Transfer',
  'Passeios não citados', 'Refeições não mencionadas', 'Despesas pessoais', 'Seguro viagem',
  'Gorjetas', 'Vistos e documentação',
]

/* ═════════════ helpers ═════════════ */
let keySeq = 0
const nk = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`
const withKeys = <T extends object>(rows: T[]): (T & { _key: string })[] =>
  rows.map(r => ({ ...(r as any), _key: nk() }))

function centsToStr(c?: number | null) {
  return c ? (c / 100).toFixed(2).replace('.', ',') : ''
}
function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

async function compressAndUpload(orgSlug: string, file: File): Promise<string | null> {
  try {
    const imageCompression = (await import('browser-image-compression')).default
    const compressed = await imageCompression(file, {
      maxSizeMB: 1.2, maxWidthOrHeight: 1920, useWebWorker: true,
      fileType: file.type === 'image/png' ? 'image/png' : 'image/jpeg',
    })
    const fd = new FormData()
    fd.append('file', new File([compressed], file.name, { type: compressed.type }))
    const res = await uploadFormAsset(orgSlug, fd)
    if (res.ok) return res.url
    toast.error(res.error)
    return null
  } catch {
    toast.error('Falha ao processar a imagem')
    return null
  }
}

/* ═════════════ rich text simples (bold/italic/lista/link) ═════════════ */
function RichField({ value, onChange, placeholder, minH = 120 }: {
  value: string; onChange: (html: string) => void; placeholder?: string; minH?: number
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false, codeBlock: false, blockquote: false, horizontalRule: false,
        link: { openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } },
      }),
      Placeholder.configure({ placeholder: placeholder || 'Escreva aqui…' }),
    ],
    content: value || '',
    // editor vazio persiste como '' (não '<p></p>') para o bloco sumir da entrega
    onUpdate({ editor }) { onChange(editor.isEmpty ? '' : editor.getHTML()) },
    editorProps: {
      attributes: { class: `prose prose-sm dark:prose-invert max-w-none focus:outline-none px-3 py-2`, style: `min-height:${minH}px` },
    },
  })
  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href
    const url = window.prompt('URL do link', prev || 'https://')
    if (url === null) return
    if (url === '') editor.chain().focus().extendMarkRange('link').unsetLink().run()
    else editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])
  if (!editor) return <div className="border rounded-md p-3 text-xs text-muted-foreground">Carregando…</div>
  const TB = ({ act, on, title, children }: any) => (
    <button type="button" title={title} onClick={on}
      className={`inline-flex items-center justify-center w-7 h-7 rounded text-sm ${act ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'}`}>
      {children}
    </button>
  )
  return (
    <div className="border rounded-md bg-background">
      <div className="border-b px-1.5 py-1 flex gap-0.5">
        <TB title="Negrito" act={editor.isActive('bold')} on={() => editor.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></TB>
        <TB title="Itálico" act={editor.isActive('italic')} on={() => editor.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></TB>
        <TB title="Lista" act={editor.isActive('bulletList')} on={() => editor.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></TB>
        <TB title="Lista numerada" act={editor.isActive('orderedList')} on={() => editor.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></TB>
        <TB title="Link" act={editor.isActive('link')} on={setLink}><LinkIcon className="w-3.5 h-3.5" /></TB>
      </div>
      <EditorContent editor={editor} />
    </div>
  )
}

/* ═════════════ upload de imagem (única) com colar/arrastar ═════════════ */
function CoverUpload({ orgSlug, url, onChange }: { orgSlug: string; url?: string | null; onChange: (u: string | null) => void }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const handle = useCallback(async (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    setBusy(true)
    const u = await compressAndUpload(orgSlug, file)
    setBusy(false)
    if (u) onChange(u)
  }, [orgSlug, onChange])
  return (
    <div
      className="relative border-2 border-dashed rounded-lg overflow-hidden bg-muted/30 min-h-[120px] flex items-center justify-center text-center"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files?.[0]) }}
      onPaste={e => { const f = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))?.getAsFile(); if (f) { e.preventDefault(); handle(f) } }}
      tabIndex={0}
    >
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
      {url ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Capa" className="w-full h-40 object-cover" />
          <div className="absolute bottom-2 right-2 flex gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => inputRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => onChange(null)}><Trash2 className="w-3.5 h-3.5" /></Button>
          </div>
        </>
      ) : (
        <button type="button" className="p-6 text-sm text-muted-foreground w-full" onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><ImageIcon className="w-6 h-6 mx-auto mb-2" />Clique, cole (Ctrl+V) ou arraste a imagem de capa</>}
        </button>
      )}
    </div>
  )
}

/* ═════════════ galeria de fotos (multi) ═════════════ */
function PhotoGallery({ orgSlug, photos, onChange }: { orgSlug: string; photos: string[]; onChange: (p: string[]) => void }) {
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const addFiles = useCallback(async (files: File[]) => {
    const imgs = files.filter(f => f.type.startsWith('image/'))
    if (!imgs.length) return
    setBusy(true)
    const urls: string[] = []
    for (const f of imgs.slice(0, 8)) {
      const u = await compressAndUpload(orgSlug, f)
      if (u) urls.push(u)
    }
    setBusy(false)
    if (urls.length) onChange([...photos, ...urls])
  }, [orgSlug, photos, onChange])
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= photos.length) return
    const n = [...photos]; const t = n[i]; n[i] = n[j]; n[j] = t
    onChange(n)
  }
  return (
    <div
      className="border-2 border-dashed rounded-lg p-3 bg-muted/20"
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); addFiles(Array.from(e.dataTransfer.files || [])) }}
      onPaste={e => {
        const fs = Array.from(e.clipboardData.items).filter(i => i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean) as File[]
        if (fs.length) { e.preventDefault(); addFiles(fs) }
      }}
      tabIndex={0}
    >
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => addFiles(Array.from(e.target.files || []))} />
      <div className="flex flex-wrap gap-2">
        {photos.map((src, i) => (
          <div key={src + i} className="relative group w-24 h-20 rounded-md overflow-hidden border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
              <button type="button" title="Mover p/ trás" className="text-white/90 hover:text-white" onClick={() => move(i, -1)}><ChevronLeft className="w-4 h-4" /></button>
              <button type="button" title="Remover" className="text-white/90 hover:text-red-300" onClick={() => onChange(photos.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4" /></button>
              <button type="button" title="Mover p/ frente" className="text-white/90 hover:text-white" onClick={() => move(i, 1)}><ChevronRight className="w-4 h-4" /></button>
            </div>
            {i === 0 && <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-black/60 text-white px-1.5 py-0.5 rounded">capa</span>}
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-24 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 text-[11px] gap-1">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" />foto</>}
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">Cole (Ctrl+V) ou arraste imagens aqui. A 1ª foto é o destaque da galeria.</p>
    </div>
  )
}

/* ═════════════ dnd-kit: item ordenável genérico ═════════════ */
function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: DndCSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 }}
      className="rounded-lg border bg-background">
      <div className="flex items-start gap-1 p-3">
        <button type="button" {...attributes} {...listeners}
          className="mt-1 text-muted-foreground/60 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
          aria-label="Arrastar para reordenar">
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0 space-y-2">{children}</div>
      </div>
    </div>
  )
}

function SortableList<T extends { _key: string }>({
  items, onReorder, render,
}: { items: T[]; onReorder: (n: T[]) => void; render: (item: T, i: number) => React.ReactNode }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldI = items.findIndex(x => x._key === active.id)
    const newI = items.findIndex(x => x._key === over.id)
    onReorder(arrayMove(items, oldI, newI))
  }
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map(x => x._key)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((it, i) => <SortableRow key={it._key} id={it._key}>{render(it, i)}</SortableRow>)}
        </div>
      </SortableContext>
    </DndContext>
  )
}

/* ═════════════ campos utilitários ═════════════ */
function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

function EditBlock({ icon: Icon, title, children, action }: { icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

/** Lista simples de strings (incluso / não incluso / itens do dia).
 *  `suggestions` vira chips clicáveis que adicionam/removem o item. */
function StringList({ items, onChange, placeholder, suggestions }: {
  items: string[]; onChange: (v: string[]) => void; placeholder: string; suggestions?: string[]
}) {
  return (
    <div className="space-y-1.5">
      {suggestions && suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1 pb-1">
          {suggestions.map(s => {
            const on = items.includes(s)
            return (
              <button key={s} type="button"
                onClick={() => onChange(on ? items.filter(x => x !== s) : [...items, s])}
                className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                  on ? 'bg-primary text-primary-foreground border-primary'
                     : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                }`}>
                {on ? '✓ ' : '+ '}{s}
              </button>
            )
          })}
        </div>
      )}
      {items.map((it, i) => (
        <div key={i} className="flex gap-1.5">
          <Input value={it} placeholder={placeholder}
            onChange={e => { const n = [...items]; n[i] = e.target.value; onChange(n) }} />
          <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
            onClick={() => onChange(items.filter((_, j) => j !== i))}><Trash2 className="w-3.5 h-3.5" /></Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, ''])}>
        <Plus className="w-3.5 h-3.5 mr-1" /> Item
      </Button>
    </div>
  )
}

/** Seletor de franquias de bagagem: botões só com ícone + resumo textual. */
function BaggagePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const ICONS: Record<string, React.ReactNode> = {
    item_pessoal: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2Z" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 21v-5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5M8 10h8" /></svg>,
    mao: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="6" y="7" width="12" height="14" rx="2" /><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M10 11v6M14 11v6" /></svg>,
    despachada: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="4" y="6" width="16" height="14" rx="2" /><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M8 10v6M16 10v6M12 10v6" /></svg>,
  }
  const selected = BAGGAGE_OPTIONS.filter(o => value.includes(o.key))
  return (
    <div>
      <div className="flex gap-1">
        {BAGGAGE_OPTIONS.map(o => {
          const on = value.includes(o.key)
          return (
            <button key={o.key} type="button" title={o.label}
              onClick={() => onChange(on ? value.filter(k => k !== o.key) : [...value, o.key])}
              className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
                on ? 'bg-primary text-primary-foreground border-primary'
                   : 'bg-background text-muted-foreground border-border hover:bg-muted'
              }`}>
              {ICONS[o.key]}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1">
        {selected.length > 0 ? `Inclui: ${selected.map(o => o.label).join(' · ')}` : 'Nenhuma franquia selecionada'}
      </p>
    </div>
  )
}

/* ═════════════ estado do editor ═════════════ */
type Lodging = { _key: string; name: string; check_in?: string | null; check_out?: string | null; room_category?: string | null; board?: string | null; description_html?: string | null; photos: string[]; lat?: number | null; lng?: number | null; tripadvisor_location_id?: string | null; tripadvisor_data?: any }
type Flight = { _key: string; leg_type: string; from_code?: string | null; from_city?: string | null; to_code?: string | null; to_city?: string | null; airline?: string | null; date?: string | null; duration_label?: string | null; stopover_label?: string | null; baggage: string[]; cabin_class?: string | null }
type Day = { _key: string; day_label: string; date?: string | null; title: string; items: string[] }
type Pin = { _key: string; label: string; type: string; lat?: number | null; lng?: number | null; _query?: string }

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', sent: 'Enviada', viewed: 'Visualizada', won: 'Fechada', lost: 'Perdida', expired: 'Expirada',
}

export default function QuotationEditor({ orgSlug, initial, leads = [] }: {
  orgSlug: string; initial: QuotationFull; leads?: { id: string; name: string }[]
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
    included: (q0.included || []) as string[], not_included: (q0.not_included || []) as string[],
    price_per_person_cents: (q0.price_per_person_cents ?? null) as number | null,
    total_cents: (q0.total_cents || 0) as number,
    total_manual: false,
    payment_conditions: (Array.isArray(q0.payment_conditions) ? q0.payment_conditions : []).map((x: any) => ({ label: x?.label || '', value: x?.value || '' })),
    price_disclaimer: q0.price_disclaimer || '',
    validity_days: q0.validity_days || 5,
    operadora: q0.operadora || '', commission_total_cents: q0.commission_total_cents || 0,
  }))
  const [lodgings, setLodgings] = useState<Lodging[]>(() => withKeys(initial.lodgings.map(l => ({
    name: l.name || '', check_in: l.check_in, check_out: l.check_out, room_category: l.room_category,
    board: l.board, description_html: l.description_html, photos: (l.photos || []) as string[],
    lat: l.lat, lng: l.lng, tripadvisor_location_id: l.tripadvisor_location_id, tripadvisor_data: l.tripadvisor_data,
  }))) as Lodging[])
  const [flights, setFlights] = useState<Flight[]>(() => withKeys(initial.flights.map(f => ({
    leg_type: f.leg_type || 'outbound', from_code: f.from_code, from_city: f.from_city,
    to_code: f.to_code, to_city: f.to_city, airline: f.airline, date: f.date,
    duration_label: f.duration_label, stopover_label: f.stopover_label,
    baggage: (f.baggage || []) as string[], cabin_class: f.cabin_class || null,
  }))) as Flight[])
  const [days, setDays] = useState<Day[]>(() => withKeys(initial.itinerary_days.map(d => ({
    day_label: d.day_label || '', date: d.date, title: d.title || '', items: (d.items || []) as string[],
  }))) as Day[])
  const [pins, setPins] = useState<Pin[]>(() => withKeys(initial.map_pins.map(p => ({
    label: p.label || '', type: p.type || 'attraction', lat: p.lat, lng: p.lng,
  }))) as Pin[])

  const [publicToken, setPublicToken] = useState<string | null>(q0.public_token || null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [taBusy, setTaBusy] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form')
  const [saleBusy, setSaleBusy] = useState(false)

  const paxTotal = (q.pax_adults || 0) + (q.pax_children || 0)

  // total automático = por pessoa × pax (com toggle manual)
  useEffect(() => {
    if (q.total_manual) return
    const auto = (q.price_per_person_cents || 0) * Math.max(paxTotal, 1)
    if (q.price_per_person_cents != null && auto !== q.total_cents) {
      setQ(s => ({ ...s, total_cents: auto }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.price_per_person_cents, paxTotal, q.total_manual])

  /* ─────── payload + autosave ─────── */
  const payload = useMemo(() => ({
    title: q.title || null, subtitle: q.subtitle || null, status: q.status as any,
    contato_id: q.contato_id,
    client_name: q.client_name || null, client_whatsapp: q.client_whatsapp || null,
    cover_image_url: q.cover_image_url || null,
    origin_label: q.origin_label || null, origin_note: q.origin_note || null,
    destinations: q.destinations.filter(d => d.name),
    start_date: q.start_date || null, end_date: q.end_date || null,
    pax_adults: q.pax_adults, pax_children: q.pax_children, children_ages: q.children_ages,
    occupancy_label: q.occupancy_label || null,
    intro_html: q.intro_html || null, important_html: q.important_html || null, closing_html: q.closing_html || null,
    cancellation_html: q.cancellation_html || null,
    included: q.included.filter(Boolean), not_included: q.not_included.filter(Boolean),
    price_per_person_cents: q.price_per_person_cents, total_cents: q.total_cents,
    payment_conditions: q.payment_conditions.filter(p => p.label || p.value),
    price_disclaimer: q.price_disclaimer || null, validity_days: q.validity_days,
    operadora: q.operadora || null, commission_total_cents: q.commission_total_cents,
    lodgings: lodgings.map(({ _key, ...l }) => l),
    flights: flights.map(({ _key, ...f }) => ({ ...f, leg_type: f.leg_type as any, baggage: f.baggage as any, cabin_class: (f.cabin_class || null) as any })),
    itinerary_days: days.map(({ _key, ...d }) => ({ ...d, items: d.items.filter(Boolean) })),
    map_pins: pins.filter(p => p.lat != null && p.lng != null).map(p => ({ label: p.label, type: p.type as any, lat: p.lat!, lng: p.lng! })),
  }), [q, lodgings, flights, days, pins])

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

  /* ─────── preview ─────── */
  const previewData: PublicQuotation = useMemo(() => ({
    id: q0.id, status: q.status, expired: false,
    client_name: q.client_name, title: q.title, subtitle: q.subtitle,
    cover_image_url: q.cover_image_url,
    origin_label: q.origin_label, origin_note: q.origin_note,
    destinations: q.destinations,
    departure_date: q.start_date || null, return_date: q.end_date || null,
    pax_adults: q.pax_adults, pax_children: q.pax_children, children_ages: q.children_ages,
    occupancy_label: q.occupancy_label,
    intro_html: q.intro_html, important_html: q.important_html, closing_html: q.closing_html,
    cancellation_html: q.cancellation_html,
    included: q.included.filter(Boolean), not_included: q.not_included.filter(Boolean),
    price_per_person_cents: q.price_per_person_cents, total_cents: q.total_cents,
    payment_conditions: q.payment_conditions,
    price_disclaimer: q.price_disclaimer, quoted_at: q0.quoted_at || q0.updated_at,
    validity_days: q.validity_days,
    lodgings: lodgings.map(l => ({ ...l })),
    flights: flights.map(f => ({ ...f })),
    itinerary_days: days.map(d => ({ ...d })),
    map_pins: pins.filter(p => p.lat != null && p.lng != null).map(p => ({ label: p.label, type: p.type, lat: p.lat!, lng: p.lng! })),
    org: {
      legal_name: initial.org_settings?.legal_name, brand_logo_url: initial.org_settings?.brand_logo_url,
      brand_accent: initial.org_settings?.brand_accent, instagram_url: initial.org_settings?.instagram_url,
      site_url: initial.org_settings?.site_url, terms_url: initial.org_settings?.terms_url,
      privacy_url: initial.org_settings?.privacy_url, whatsapp_number: initial.org_settings?.whatsapp_number,
      city_state: initial.org_settings?.city_state, cnpj: initial.org_settings?.cnpj,
    },
  }), [q, lodgings, flights, days, pins, q0, initial.org_settings])
  // preview remonta quando dados estruturais mudam (mapa/accordion medem o DOM)
  const previewKey = useMemo(() => payloadJson.length + ':' + lodgings.length + ':' + flights.length + ':' + days.length, [payloadJson, lodgings, flights, days])

  /* ─────── ações ─────── */
  const missing: string[] = []
  if (!q.title) missing.push('título')
  if (!q.start_date) missing.push('data de ida')
  if (!q.price_per_person_cents) missing.push('valor por pessoa')

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

  async function onGenerateSale() {
    // Grava o estado atual antes para a venda nascer com os dados mais recentes.
    setSaleBusy(true)
    await saveQuotation(orgSlug, q0.id, payload)
    const res = await createSaleFromQuotation(orgSlug, q0.id)
    setSaleBusy(false)
    if (res.ok) {
      toast.success(res.existed ? 'Esta cotação já tinha uma venda — abrindo…' : 'Venda criada com os dados da cotação')
      router.push(`/app/${orgSlug}/reservas?sale=${res.saleId}`)
    } else toast.error(res.error)
  }

  async function taLookup(l: Lodging) {
    if (!l.name) { toast.error('Preencha o nome do hotel antes de buscar'); return }
    setTaBusy(l._key)
    const res = await tripadvisorLookup(orgSlug, l.name)
    setTaBusy(null)
    if (res.ok) {
      setLodgings(ls => ls.map(x => x._key === l._key ? {
        ...x,
        tripadvisor_location_id: res.location_id,
        tripadvisor_data: res.data,
        lat: x.lat ?? res.data.lat ?? null,
        lng: x.lng ?? res.data.lng ?? null,
        photos: x.photos.length ? x.photos : (res.data.photos || []).slice(0, 5),
      } : x))
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

  /* ═════════════ render ═════════════ */
  const form = (
    <div className="space-y-4 pb-24">
      {/* CAPA */}
      <EditBlock icon={ImageIcon} title="Capa">
        <F label="Título (H1 do hero)"><Input value={q.title} onChange={e => setQ(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Punta Cana, 7 noites à beira-mar" /></F>
        <F label="Subtítulo (H2)"><Input value={q.subtitle} onChange={e => setQ(s => ({ ...s, subtitle: e.target.value }))} placeholder="Ex.: All-inclusive no Caribe — sol, mar e descanso" /></F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Nome do cliente"><Input value={q.client_name} onChange={e => setQ(s => ({ ...s, client_name: e.target.value }))} placeholder="Ex.: Ricardo Almeida" /></F>
          <F label="Vincular ao contato do CRM" hint="liga a cotação ao lead da pipeline (timeline + lead scoring)">
            <Select value={q.contato_id || 'none'}
              onValueChange={v => setQ(s => {
                const lead = leads.find(l => l.id === v)
                return { ...s, contato_id: v === 'none' ? null : v, client_name: s.client_name || lead?.name || '' }
              })}>
              <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem vínculo</SelectItem>
                {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </F>
        </div>
        <F label="Imagem de capa"><CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))} /></F>
      </EditBlock>

      {/* VIAGEM */}
      <EditBlock icon={MapPin} title="Viagem">
        <div className="grid grid-cols-2 gap-3">
          <F label="Saída (cidade)"><Input value={q.origin_label} onChange={e => setQ(s => ({ ...s, origin_label: e.target.value }))} placeholder="Florianópolis" /></F>
          <F label="Nota da saída"><Input value={q.origin_note} onChange={e => setQ(s => ({ ...s, origin_note: e.target.value }))} placeholder="FLN · conexão em GRU" /></F>
        </div>
        <F label="Destino(s)">
          <div className="space-y-1.5">
            {q.destinations.map((d, i) => (
              <div key={i} className="flex gap-1.5">
                <Input className="flex-1" placeholder="Punta Cana" value={d.name}
                  onChange={e => setQ(s => { const n = [...s.destinations]; n[i] = { ...n[i], name: e.target.value }; return { ...s, destinations: n } })} />
                <Input className="w-40" placeholder="País" value={d.country || ''}
                  onChange={e => setQ(s => { const n = [...s.destinations]; n[i] = { ...n[i], country: e.target.value }; return { ...s, destinations: n } })} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => setQ(s => ({ ...s, destinations: s.destinations.filter((_, j) => j !== i) }))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setQ(s => ({ ...s, destinations: [...s.destinations, { name: '', country: '' }] }))}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Destino
            </Button>
          </div>
        </F>
        <div className="grid grid-cols-2 gap-3">
          <F label="Data de ida"><Input type="date" value={q.start_date} onChange={e => setQ(s => ({ ...s, start_date: e.target.value }))} /></F>
          <F label="Data de volta"><Input type="date" value={q.end_date} onChange={e => setQ(s => ({ ...s, end_date: e.target.value }))} /></F>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <F label="Adultos"><Input type="number" min={0} value={q.pax_adults} onChange={e => setQ(s => ({ ...s, pax_adults: Math.max(0, parseInt(e.target.value) || 0) }))} /></F>
          <F label="Crianças"><Input type="number" min={0} value={q.pax_children} onChange={e => {
            const n = Math.max(0, parseInt(e.target.value) || 0)
            setQ(s => ({ ...s, pax_children: n, children_ages: s.children_ages.slice(0, n) }))
          }} /></F>
          <F label="Ocupação"><Input value={q.occupancy_label} onChange={e => setQ(s => ({ ...s, occupancy_label: e.target.value }))} placeholder="ocupação dupla" /></F>
        </div>
        {q.pax_children > 0 && (
          <F label="Idades das crianças">
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: q.pax_children }).map((_, i) => (
                <Input key={i} type="number" min={0} max={17} className="w-16" value={q.children_ages[i] ?? ''}
                  onChange={e => setQ(s => { const n = [...s.children_ages]; n[i] = Math.min(17, Math.max(0, parseInt(e.target.value) || 0)); return { ...s, children_ages: n } })} />
              ))}
            </div>
          </F>
        )}
      </EditBlock>

      {/* INTRODUÇÃO */}
      <EditBlock icon={Sparkles} title="Introdução">
        <RichField value={q.intro_html} onChange={html => setQ(s => ({ ...s, intro_html: html }))}
          placeholder="Mensagem pessoal de abertura para o cliente (com sua assinatura)…" />
      </EditBlock>

      {/* HOSPEDAGENS */}
      <EditBlock icon={BedDouble} title="Hospedagens"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setLodgings(ls => [...ls, { _key: nk(), name: '', photos: [], check_in: q.start_date || null, check_out: q.end_date || null }])}>
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
              <p className="text-[11px] text-emerald-600">✓ TripAdvisor vinculado{l.tripadvisor_data.rating ? ` · nota ${l.tripadvisor_data.rating}` : ''}{l.tripadvisor_data.reviews_count ? ` · ${l.tripadvisor_data.reviews_count} avaliações` : ''}</p>
            )}
            <div className="grid grid-cols-2 gap-2">
              <F label="Check-in"><Input type="date" value={l.check_in || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_in: e.target.value } : x))} /></F>
              <F label="Check-out"><Input type="date" value={l.check_out || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, check_out: e.target.value } : x))} /></F>
              <F label="Categoria do quarto"><Input placeholder="Suíte The Level · vista jardim" value={l.room_category || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, room_category: e.target.value } : x))} /></F>
              <F label="Regime"><Input placeholder="All-Inclusive" value={l.board || ''} onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, board: e.target.value } : x))} /></F>
            </div>
            <F label="Descrição">
              <RichField minH={80} value={l.description_html || ''} placeholder="Por que essa hospedagem é a escolha certa…"
                onChange={html => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, description_html: html } : x))} />
            </F>
            <F label="Fotos">
              <PhotoGallery orgSlug={orgSlug} photos={l.photos}
                onChange={p => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, photos: p } : x))} />
            </F>
          </>
        )} />
      </EditBlock>

      {/* AÉREO */}
      <EditBlock icon={Plane} title="Aéreo"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setFlights(fs => [...fs, { _key: nk(), leg_type: fs.length === 0 ? 'outbound' : 'inbound', baggage: [] }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Trecho
        </Button>}>
        {flights.length === 0 && <p className="text-sm text-muted-foreground">Nenhum trecho aéreo.</p>}
        <SortableList items={flights} onReorder={setFlights} render={(f) => (
          <>
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
              <F label="Data"><Input type="date" value={f.date || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, date: e.target.value } : x))} /></F>
              <F label="Duração"><Input placeholder="≈ 12h total" value={f.duration_label || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, duration_label: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Origem (código)"><Input placeholder="FLN" maxLength={4} value={f.from_code || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, from_code: e.target.value.toUpperCase() } : x))} /></F>
              <F label="Cidade origem"><Input placeholder="Florianópolis" value={f.from_city || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, from_city: e.target.value } : x))} /></F>
              <F label="Destino (código)"><Input placeholder="PUJ" maxLength={4} value={f.to_code || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, to_code: e.target.value.toUpperCase() } : x))} /></F>
              <F label="Cidade destino"><Input placeholder="Punta Cana" value={f.to_city || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, to_city: e.target.value } : x))} /></F>
            </div>
            <div className="flex gap-2 items-end">
              <div className="flex-1"><F label="Escala / observação"><Input placeholder="via Panamá (PTY)" value={f.stopover_label || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, stopover_label: e.target.value } : x))} /></F></div>
              <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                onClick={() => setFlights(fs => fs.filter(x => x._key !== f._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            <div className="grid grid-cols-2 gap-2 items-start">
              <F label="Bagagens incluídas">
                <BaggagePicker value={f.baggage}
                  onChange={b => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, baggage: b } : x))} />
              </F>
              <F label="Classe">
                <Select value={f.cabin_class || 'none'}
                  onValueChange={v => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, cabin_class: v === 'none' ? null : v } : x))}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não exibir</SelectItem>
                    {Object.entries(CABIN_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
            </div>
          </>
        )} />
      </EditBlock>

      {/* MAPA */}
      <EditBlock icon={MapIcon} title="Mapa"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setPins(ps => [...ps, { _key: nk(), label: '', type: 'attraction' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Pin
        </Button>}>
        <p className="text-[11px] text-muted-foreground">Hospedagens com localização (via TripAdvisor) entram no mapa automaticamente. Adicione aqui atrações e aeroporto.</p>
        {pins.map(p => (
          <div key={p._key} className="rounded-lg border p-2.5 space-y-2">
            <div className="flex gap-1.5">
              <Select value={p.type} onValueChange={v => setPins(ps => ps.map(x => x._key === p._key ? { ...x, type: v } : x))}>
                <SelectTrigger className="w-[120px] shrink-0 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="attraction">Atração</SelectItem>
                  <SelectItem value="airport">Aeroporto</SelectItem>
                  <SelectItem value="lodging">Hospedagem</SelectItem>
                  <SelectItem value="custom">Outro</SelectItem>
                </SelectContent>
              </Select>
              <Input className="flex-1" placeholder="Local (ex.: Isla Saona)" value={p._query ?? p.label}
                onChange={e => setPins(ps => ps.map(x => x._key === p._key ? { ...x, _query: e.target.value, label: e.target.value, lat: null, lng: null } : x))} />
              <Button type="button" variant="outline" size="icon" className="shrink-0" disabled={geoBusy === p._key}
                title="Buscar coordenadas" onClick={() => pinGeocode(p)}>
                {geoBusy === p._key ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4" />}
              </Button>
              <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                onClick={() => setPins(ps => ps.filter(x => x._key !== p._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {p.lat != null
              ? <p className="text-[11px] text-emerald-600">✓ posicionado ({p.lat!.toFixed(4)}, {p.lng!.toFixed(4)})</p>
              : <p className="text-[11px] text-amber-600">sem posição — clique na mira para buscar</p>}
          </div>
        ))}
      </EditBlock>

      {/* ITINERÁRIO */}
      <EditBlock icon={Route} title="Itinerário"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setDays(ds => [...ds, { _key: nk(), day_label: `Dia ${ds.length + 1}`, title: '', items: [] }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Dia
        </Button>}>
        {days.length === 0 && <p className="text-sm text-muted-foreground">Nenhum dia no itinerário.</p>}
        <SortableList items={days} onReorder={setDays} render={(d) => (
          <>
            <div className="grid grid-cols-3 gap-2">
              <F label="Rótulo"><Input placeholder="Dia 1" value={d.day_label} onChange={e => setDays(ds => ds.map(x => x._key === d._key ? { ...x, day_label: e.target.value } : x))} /></F>
              <F label="Data"><Input type="date" value={d.date || ''} onChange={e => setDays(ds => ds.map(x => x._key === d._key ? { ...x, date: e.target.value } : x))} /></F>
              <div className="flex items-end justify-end">
                <Button type="button" variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10"
                  onClick={() => setDays(ds => ds.filter(x => x._key !== d._key))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            </div>
            <F label="Título do dia"><Input placeholder="Chegada e check-in" value={d.title} onChange={e => setDays(ds => ds.map(x => x._key === d._key ? { ...x, title: e.target.value } : x))} /></F>
            <F label="Itens">
              <StringList items={d.items} placeholder="🚐 Transfer privativo ao resort"
                onChange={items => setDays(ds => ds.map(x => x._key === d._key ? { ...x, items } : x))} />
            </F>
          </>
        )} />
      </EditBlock>

      {/* IMPORTANTE */}
      <EditBlock icon={AlertTriangle} title="Importante">
        <RichField value={q.important_html} onChange={html => setQ(s => ({ ...s, important_html: html }))}
          placeholder="Documentos, vacinas, clima, seguro, dicas — o que o cliente precisa saber antes de fechar…" />
      </EditBlock>

      {/* O QUE INCLUI */}
      <EditBlock icon={CheckCircle2} title="O que inclui">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Incluso"><StringList items={q.included} placeholder="Passagem aérea ida e volta" suggestions={INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, included: v }))} /></F>
          <F label="Não incluso"><StringList items={q.not_included} placeholder="Seguro viagem" suggestions={NOT_INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, not_included: v }))} /></F>
        </div>
      </EditBlock>

      {/* POLÍTICAS DE CANCELAMENTO */}
      <EditBlock icon={AlertTriangle} title="Políticas de cancelamento">
        <RichField value={q.cancellation_html} onChange={html => setQ(s => ({ ...s, cancellation_html: html }))}
          placeholder="Condições de alteração, cancelamento e reembolso — escreva do jeito que preferir…" />
      </EditBlock>

      {/* INVESTIMENTO */}
      <EditBlock icon={Wallet} title="Investimento">
        <div className="grid grid-cols-2 gap-3">
          <F label="Valor por pessoa (R$)">
            <Input inputMode="decimal" placeholder="8.900,00" defaultValue={centsToStr(q.price_per_person_cents)}
              onChange={e => setQ(s => ({ ...s, price_per_person_cents: strToCents(e.target.value) || null }))} />
          </F>
          <F label={`Total${paxTotal ? ` · ${paxTotal} pessoas` : ''}`} hint={q.total_manual ? 'valor manual' : 'calculado automaticamente'}>
            <div className="flex gap-1.5">
              <Input inputMode="decimal" value={centsToStr(q.total_cents)} disabled={!q.total_manual}
                onChange={e => setQ(s => ({ ...s, total_cents: strToCents(e.target.value) }))} />
              <Button type="button" variant={q.total_manual ? 'default' : 'outline'} size="sm" className="shrink-0"
                title="Alternar total manual" onClick={() => setQ(s => ({ ...s, total_manual: !s.total_manual }))}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          </F>
        </div>
        <F label="Condições de pagamento">
          <div className="space-y-1.5">
            {q.payment_conditions.map((p, i) => (
              <div key={i} className="flex gap-1.5">
                <Input className="w-44" placeholder="À vista (Pix)" value={p.label}
                  onChange={e => setQ(s => { const n = [...s.payment_conditions]; n[i] = { ...n[i], label: e.target.value }; return { ...s, payment_conditions: n } })} />
                <Input className="flex-1" placeholder="R$ 16.910 · 5% off" value={p.value}
                  onChange={e => setQ(s => { const n = [...s.payment_conditions]; n[i] = { ...n[i], value: e.target.value }; return { ...s, payment_conditions: n } })} />
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => setQ(s => ({ ...s, payment_conditions: s.payment_conditions.filter((_, j) => j !== i) }))}><Trash2 className="w-3.5 h-3.5" /></Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => setQ(s => ({ ...s, payment_conditions: [...s.payment_conditions, { label: '', value: '' }] }))}>
              <Plus className="w-3.5 h-3.5 mr-1" /> Condição
            </Button>
          </div>
        </F>
        <div className="grid grid-cols-[1fr_120px] gap-3">
          <F label="Disclaimer"><Textarea rows={2} placeholder="Preços sujeitos a alteração sem aviso prévio…" value={q.price_disclaimer}
            onChange={e => setQ(s => ({ ...s, price_disclaimer: e.target.value }))} /></F>
          <F label="Validade (dias)"><Input type="number" min={1} max={90} value={q.validity_days}
            onChange={e => setQ(s => ({ ...s, validity_days: Math.max(1, parseInt(e.target.value) || 5) }))} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <F label="Operadora (interno)"><Input value={q.operadora} onChange={e => setQ(s => ({ ...s, operadora: e.target.value }))} placeholder="Não aparece na proposta" /></F>
          <F label="Comissão total (interno)"><Input inputMode="decimal" defaultValue={centsToStr(q.commission_total_cents)}
            onChange={e => setQ(s => ({ ...s, commission_total_cents: strToCents(e.target.value) }))} /></F>
        </div>
      </EditBlock>

      {/* FECHAMENTO */}
      <EditBlock icon={MessageCircle} title="Fechamento">
        <RichField value={q.closing_html} onChange={html => setQ(s => ({ ...s, closing_html: html }))}
          placeholder="Texto final de convite à reserva (título + parágrafo)…" minH={80} />
        <p className="text-[11px] text-muted-foreground">
          Os botões de WhatsApp usam o número configurado da agência
          {initial.org_settings?.whatsapp_number ? ` (${initial.org_settings.whatsapp_number})` : ' — nenhum configurado'}.
          {' '}Rodapé e white-label vêm das{' '}
          <Link href={`/app/${orgSlug}/configuracoes/organizacoes`} className="underline">configurações da agência</Link>.
        </p>
      </EditBlock>
    </div>
  )

  return (
    <div className="pb-8">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-2.5 bg-background/85 backdrop-blur border-b flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/cotacoes`}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <span className="text-sm font-semibold truncate flex-1 min-w-[120px]">{q.title || 'Nova cotação'}</span>
        <span className={`text-[11px] ${saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? '✓ Salvo' : saveState === 'error' ? 'Erro ao salvar' : ''}
        </span>
        <Select value={q.status} onValueChange={v => setQ(s => ({ ...s, status: v }))}>
          <SelectTrigger className="w-[128px] h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        {publicUrl && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + publicUrl); toast.success('Link copiado') } catch { toast.error('Não foi possível copiar') }
            }}><Copy className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Copiar link</span></Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Abrir</span></a>
            </Button>
          </>
        )}
        <Button type="button" size="sm" onClick={() => onGenerateLink(false)}>
          <Link2 className="w-3.5 h-3.5 mr-1" /> {publicToken ? 'Reenviar' : 'Gerar link'}
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={onGenerateSale} disabled={saleBusy}>
          {saleBusy ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5 sm:mr-1" />}
          <span className="hidden sm:inline">Gerar venda</span>
        </Button>
        {missing.length > 0 && (
          <span className="w-full sm:w-auto inline-flex items-center gap-1.5 text-[11px] text-amber-600">
            <AlertTriangle className="w-3.5 h-3.5" /> Pendentes: {missing.join(', ')}
          </span>
        )}
      </div>

      {/* Mobile: alternador form/preview */}
      <div className="lg:hidden flex gap-1 mt-3">
        <Button size="sm" variant={mobileTab === 'form' ? 'default' : 'outline'} onClick={() => setMobileTab('form')}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Button>
        <Button size="sm" variant={mobileTab === 'preview' ? 'default' : 'outline'} onClick={() => setMobileTab('preview')}><Eye className="w-3.5 h-3.5 mr-1" /> Preview</Button>
      </div>

      {/* Split view */}
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(380px,44%)_1fr] items-start">
        <div className={mobileTab === 'form' ? '' : 'hidden lg:block'}>{form}</div>
        <div className={`${mobileTab === 'preview' ? '' : 'hidden lg:block'} lg:sticky lg:top-[52px]`}>
          <div className="rounded-xl border overflow-hidden shadow-sm bg-white">
            <div className="px-3 py-1.5 border-b bg-muted/40 text-[11px] text-muted-foreground flex items-center gap-2">
              <Eye className="w-3.5 h-3.5" /> Preview ao vivo — é exatamente o que o cliente verá
            </div>
            <div className="h-[calc(100vh-140px)] overflow-y-auto">
              <PublicQuotationView key={previewKey} data={previewData} preview />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
