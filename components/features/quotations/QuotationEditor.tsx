'use client'

/**
 * Editor da Cotação — formulário em largura total (1:1 com a entrega).
 * Use o botão "Abrir" pra ver a proposta pública real em nova aba.
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
import { Switch } from '@/components/ui/switch'
import {
  ArrowLeft, Plus, Trash2, GripVertical, Upload, Loader2, Copy, ExternalLink,
  CheckCircle2, Link2, Image as ImageIcon, Search, Bold, Italic, List, ListOrdered,
  Link as LinkIcon, MapPin, Plane, BedDouble, Route, AlertTriangle, Wallet,
  Sparkles, FileText, Map as MapIcon, MessageCircle, Settings2, LocateFixed,
  ChevronLeft, ChevronRight, ChevronDown, Pencil, ShoppingBag,
  CreditCard, QrCode, Receipt, Ticket, Ship, LayoutGrid, FileEdit, Layers,
} from 'lucide-react'

// Métodos de pagamento pré-dispostos (toggle on/off como as bagagens).
const PAYMENT_METHODS = [
  { label: 'Pix', icon: QrCode, placeholder: 'Ex.: à vista com 5% de desconto' },
  { label: 'Cartão de crédito', icon: CreditCard, placeholder: 'Ex.: até 12x sem juros' },
  { label: 'Boleto', icon: Receipt, placeholder: 'Ex.: entrada + saldo em 2x' },
] as const

import { saveQuotation, generateQuotationLink, tripadvisorLookup, unsplashSearch, unsplashTrackDownload, createSaleFromQuotation, convertOfferToQuotation, convertQuotationToOffer, type QuotationFull } from '@/actions/quotations'
import { geocodePlace } from '@/actions/travel-proposals'
import { uploadFormAsset } from '@/actions/upload'
import { BAGGAGE_OPTIONS, CABIN_LABELS } from './PublicQuotationView'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'
import DocumentExtractDialog from '@/components/features/ai/DocumentExtractDialog'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import FlightOcrDialog from './FlightOcrDialog'
import type { ExtractedFlightLeg } from '@/lib/ai/flight-ocr-extract'
import CruiseOcrDialog from './CruiseOcrDialog'
import type { ExtractedCruise } from '@/lib/ai/cruise-ocr-extract'

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

/** Duração do trecho calculada a partir de partida/chegada — só quando
 *  data+hora de ambos os lados estão preenchidos; senão fica null (o
 *  campo cai de volta pro texto digitado à mão, ex.: "≈ 12h total"). */
function computeFlightDuration(f: { date?: string | null; departure_time?: string | null; arrival_date?: string | null; arrival_time?: string | null }): string | null {
  if (!f.date || !f.departure_time || !f.arrival_time) return null
  const dep = new Date(`${f.date}T${f.departure_time}`)
  const arr = new Date(`${f.arrival_date || f.date}T${f.arrival_time}`)
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return null
  let diffMin = Math.round((arr.getTime() - dep.getTime()) / 60000)
  if (diffMin <= 0) return null
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
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
function CoverUpload({
  orgSlug, url, onChange, unsplashHint,
}: { orgSlug: string; url?: string | null; onChange: (u: string | null) => void; unsplashHint?: string }) {
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
    <div className="space-y-2">
      <div
        className="relative border-2 border-dashed rounded-lg overflow-hidden bg-muted/30 aspect-video flex items-center justify-center text-center"
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handle(e.dataTransfer.files?.[0]) }}
        onPaste={e => { const f = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/'))?.getAsFile(); if (f) { e.preventDefault(); handle(f) } }}
        tabIndex={0}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => handle(e.target.files?.[0])} />
        {url ? (
          <>
            {/* Mostra a imagem inteira (object-contain), não recortada — a
                proporção padrão da capa é 16:9. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="Capa" className="w-full h-full object-contain" />
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
      <UnsplashPicker orgSlug={orgSlug} hint={unsplashHint} onPick={onChange} />
    </div>
  )
}

/* ═════════════ busca de foto de capa no Unsplash ═════════════ */
function UnsplashPicker({
  orgSlug, hint, onPick,
}: { orgSlug: string; hint?: string; onPick: (url: string) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [results, setResults] = useState<{ id: string; thumbUrl: string; fullUrl: string; downloadLocation: string; author: string; authorUrl: string }[] | null>(null)

  async function search(q: string) {
    if (!q.trim()) return
    setBusy(true)
    const res = await unsplashSearch(orgSlug, q)
    setBusy(false)
    if (res.ok) setResults(res.photos)
    else { const { toast } = await import('sonner'); toast.error(res.error) }
  }

  function openPicker() {
    setOpen(true)
    if (!results) { const q = hint || ''; setQuery(q); if (q) search(q) }
  }

  async function pick(p: { fullUrl: string; downloadLocation: string }) {
    onPick(p.fullUrl)
    setOpen(false)
    unsplashTrackDownload(orgSlug, p.downloadLocation)
  }

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={openPicker} className="w-full">
        <Search className="w-3.5 h-3.5 mr-1.5" /> Buscar foto no Unsplash
      </Button>
    )
  }

  return (
    <div className="border rounded-lg p-2.5 space-y-2 bg-muted/20">
      <div className="flex gap-1.5">
        <Input value={query} onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); search(query) } }}
          placeholder="Ex.: praia caribe, montanha, cidade europeia…" className="h-8 text-xs" />
        <Button type="button" size="sm" className="h-8" onClick={() => search(query)} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>Fechar</Button>
      </div>
      {results && results.length > 0 && (
        <div className="grid grid-cols-4 gap-1.5">
          {results.map(p => (
            <button key={p.id} type="button" onClick={() => pick(p)}
              className="relative rounded overflow-hidden aspect-square group border hover:ring-2 hover:ring-primary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.thumbUrl} alt={p.author} className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      )}
      {results && results.length === 0 && !busy && (
        <p className="text-[11px] text-muted-foreground">Nenhuma foto encontrada. Tente outro termo.</p>
      )}
      <p className="text-[10px] text-muted-foreground">Fotos via Unsplash — atribuição registrada automaticamente.</p>
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

function EditBlock({ id, icon: Icon, title, children, action }: { id?: string; icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card id={id} className={id ? 'scroll-mt-[104px]' : undefined}>
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

/**
 * Navegação em 5 grandes grupos (Construtor de Viagens) — substitui a
 * barra horizontal antiga de 13 blocos, que crescia sem limite conforme
 * novos produtos/seções eram adicionados. Cada grupo agrupa os EditBlocks
 * existentes (nenhum bloco foi removido, só reorganizado).
 */
const GROUPS = [
  { id: 'resumo', label: 'Resumo', icon: LayoutGrid },
  { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
  { id: 'conteudo', label: 'Conteúdo', icon: FileEdit },
  { id: 'investimento', label: 'Investimento', icon: Wallet },
  { id: 'fechamento', label: 'Fechamento', icon: MessageCircle },
] as const
type GroupId = (typeof GROUPS)[number]['id']

/** Nav horizontal — só no mobile, onde uma barra lateral fixa não cabe. */
function GroupNavMobile({ active, onChange, completeness }: { active: GroupId; onChange: (g: GroupId) => void; completeness: number }) {
  return (
    <div className="px-3 py-1.5 border-t flex items-center gap-2 overflow-x-auto md:hidden">
      <div className="flex gap-1 w-max">
        {GROUPS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
              active === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5 shrink-0" title={`Cotação ${completeness}% completa`}>
        <div className="w-20 h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">{completeness}%</span>
      </div>
    </div>
  )
}

/** Nav vertical — barra lateral fixa em desktop (não rola com o resto da
 *  tela), ganha espaço vertical que antes ia pra uma 2ª linha horizontal. */
function GroupNavSidebar({ active, onChange, completeness }: { active: GroupId; onChange: (g: GroupId) => void; completeness: number }) {
  return (
    <nav className="hidden md:flex md:flex-col gap-3 w-44 shrink-0 sticky top-[52px] self-start pt-2">
      <div>
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
          <span>Completude</span><span className="tabular-nums">{completeness}%</span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${completeness}%` }} />
        </div>
      </div>
      <div className="space-y-0.5">
        {GROUPS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => onChange(id)}
            className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium transition-colors text-left ${
              active === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}>
            <Icon className="w-4 h-4 shrink-0" /> {label}
          </button>
        ))}
      </div>
    </nav>
  )
}

/** Mostra os filhos só quando é o grupo ativo — os blocos internos não
 *  precisam ser fisicamente contíguos no JSX (ex.: Introdução fica entre
 *  Viagem e Hospedagens no arquivo, mas pertence a grupos diferentes);
 *  várias instâncias com o mesmo id="conteudo" funcionam normalmente. */
function GroupSection({ id, active, children }: { id: GroupId; active: GroupId; children: React.ReactNode }) {
  if (id !== active) return null
  return <>{children}</>
}

/** Disclosure simples pra separar campos Recomendado/Avançado dos
 *  Essenciais — não polui a interface principal, mas fica a 1 clique. */
function Disclosure({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t pt-2.5 mt-2.5">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground">
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} /> {label}
      </button>
      {open && <div className="space-y-2.5 mt-2.5">{children}</div>}
    </div>
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
type Lodging = { _key: string; name: string; check_in?: string | null; check_out?: string | null; room_category?: string | null; board?: string | null; description_html?: string | null; photos: string[]; lat?: number | null; lng?: number | null; tripadvisor_location_id?: string | null; tripadvisor_data?: any; is_alternative_option?: boolean; option_price_per_person_cents?: number | null; option_total_cents?: number | null }
type Flight = {
  _key: string; leg_type: string; from_code?: string | null; from_city?: string | null; to_code?: string | null; to_city?: string | null;
  airline?: string | null; flight_number?: string | null;
  date?: string | null; departure_time?: string | null; arrival_date?: string | null; arrival_time?: string | null;
  duration_label?: string | null; stopover_label?: string | null; baggage: string[]; cabin_class?: string | null
}
type Pin = { _key: string; label: string; type: string; lat?: number | null; lng?: number | null; _query?: string }

/** Dia de itinerário do cruzeiro — porto/data/horários de chegada e
 *  saída. Mesmo padrão de repeater dos demais (chave local + reorder). */
type CruiseDay = { _key: string; day_number?: number | null; date?: string | null; port?: string | null; arrival?: string | null; departure?: string | null; note?: string | null }

/** Cruzeiro — primeiro tipo de produto novo do Construtor de Viagens
 *  (ver actions/quotations.ts: ProductSchema/product_type='cruzeiro').
 *  Campos essenciais sempre visíveis; recomendados/avançados atrás de
 *  Disclosure, conforme níveis de informação do módulo. */
type Cruise = {
  _key: string
  cruise_line?: string | null; ship_name?: string | null; itinerary_name?: string | null
  embark_date?: string | null; disembark_date?: string | null; duration_nights?: number | null
  embark_port?: string | null; disembark_port?: string | null
  pax_adults?: number | null; pax_children?: number | null; occupancy_label?: string | null
  cabin_category?: string | null; cabin_type?: string | null
  cabin_price_cents?: number | null; taxes_cents?: number | null; total_cents?: number | null
  // recomendado
  cabin_number?: string | null; deck?: string | null; location?: string | null; view?: string | null; cabin_guaranteed?: boolean
  pkg_drinks?: string | null; pkg_internet?: string | null; pkg_restaurants?: string | null; pkg_gratuities?: string | null; pkg_others?: string | null
  extras_cents?: number | null; discount_cents?: number | null
  days: CruiseDay[]
  // avançado/interno — nunca aparece no público/PDF (ver internal_data)
  supplier?: string | null; fare_code?: string | null; cost_cents?: number | null; internal_notes?: string | null
}

export default function QuotationEditor({ orgSlug, initial, leads = [], isOffer = false }: {
  orgSlug: string; initial: QuotationFull; leads?: { id: string; name: string; phone?: string | null }[]; isOffer?: boolean
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
    itinerary_html: q0.itinerary_html || '',
    flights_html: (q0 as any).flights_html || '',
    tours_html: (q0 as any).tours_html || '',
    included: (q0.included || []) as string[], not_included: (q0.not_included || []) as string[],
    price_per_person_cents: (q0.price_per_person_cents ?? null) as number | null,
    total_cents: (q0.total_cents || 0) as number,
    total_manual: false,
    payment_conditions: (Array.isArray(q0.payment_conditions) ? q0.payment_conditions : [])
      .map((x: any) => {
        // Normaliza labels antigos para os 3 métodos fixos (Pix/Cartão/Boleto).
        const raw = (x?.label || '').toLowerCase()
        const label = raw.includes('pix') ? 'Pix'
          : raw.includes('cart') ? 'Cartão de crédito'
          : raw.includes('boleto') ? 'Boleto'
          : (x?.label || '')
        return { label, value: x?.value || '' }
      })
      // Descarta duplicatas do mesmo método, mantendo a primeira.
      .filter((x: any, i: number, arr: any[]) => arr.findIndex(y => y.label === x.label) === i),
    price_disclaimer: q0.price_disclaimer || '',
    validity_days: q0.validity_days || 5,
    operadora: q0.operadora || '', commission_total_cents: q0.commission_total_cents || 0,
    offer_published: !!q0.offer_published, offer_category: q0.offer_category || '',
  }))
  // Aéreo/Hospedagem vivem em quotation_products (Construtor de Viagens,
  // infra única compartilhada por todo tipo de produto) — filtra por
  // product_type e achata `data` de volta pro shape local que o resto
  // deste arquivo (ainda) espera. `_productId` guarda o id da linha em
  // quotation_products só quando o produto já existe (undefined = novo).
  const initialProducts = (initial.products || []) as any[]
  const [lodgings, setLodgings] = useState<Lodging[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'hospedagem').map(p => {
    const l = p.data || {}
    return {
      name: p.name || '', check_in: l.check_in, check_out: l.check_out, room_category: l.room_category,
      board: l.board, description_html: l.description_html, photos: (l.photos || []) as string[],
      lat: l.lat, lng: l.lng, tripadvisor_location_id: l.tripadvisor_location_id, tripadvisor_data: l.tripadvisor_data,
      is_alternative_option: !!l.is_alternative_option,
      option_price_per_person_cents: l.option_price_per_person_cents ?? null,
      option_total_cents: l.option_total_cents ?? null,
    }
  })) as Lodging[])
  const [flights, setFlights] = useState<Flight[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'aereo').map(p => {
    const f = p.data || {}
    return {
      leg_type: f.leg_type || 'outbound', from_code: f.from_code, from_city: f.from_city,
      to_code: f.to_code, to_city: f.to_city, airline: f.airline, flight_number: f.flight_number,
      date: f.date, departure_time: f.departure_time,
      arrival_date: f.arrival_date, arrival_time: f.arrival_time,
      duration_label: f.duration_label, stopover_label: f.stopover_label,
      baggage: (f.baggage || []) as string[], cabin_class: f.cabin_class || null,
    }
  })) as Flight[])
  const [pins, setPins] = useState<Pin[]>(() => withKeys(initial.map_pins.map(p => ({
    label: p.label || '', type: p.type || 'attraction', lat: p.lat, lng: p.lng,
  }))) as Pin[])
  const [cruises, setCruises] = useState<Cruise[]>(() => withKeys(initialProducts.filter(p => p.product_type === 'cruzeiro').map(p => {
    const c = p.data || {}
    const iv = p.internal_data || {}
    return {
      ...c,
      total_cents: p.price_cents ?? c.total_cents ?? null,
      days: withKeys((c.days || []) as any[]),
      supplier: iv.supplier ?? null, fare_code: iv.fare_code ?? null, cost_cents: iv.cost_cents ?? null, internal_notes: iv.internal_notes ?? null,
    }
  })) as Cruise[])

  const [publicToken, setPublicToken] = useState<string | null>(q0.public_token || null)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [taBusy, setTaBusy] = useState<string | null>(null)
  const [geoBusy, setGeoBusy] = useState<string | null>(null)
  const [saleBusy, setSaleBusy] = useState(false)
  const [extractOpen, setExtractOpen] = useState(false)
  const [flightOcrOpen, setFlightOcrOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState<GroupId>('resumo')
  const [flightsTextOpen, setFlightsTextOpen] = useState(() => !!initial.quotation.flights_html?.trim())
  const [cruiseOcrOpen, setCruiseOcrOpen] = useState(false)

  // "Ler com IA" no bloco Cruzeiro — cria um cruzeiro novo com os campos
  // preenchidos (append, igual ao OCR de voo — nunca sobrescreve o que já
  // existe na lista).
  function handleCruiseExtracted(data: ExtractedCruise) {
    setCruises(cs => [...cs, {
      _key: nk(),
      cruise_line: data.cruise_line, ship_name: data.ship_name, itinerary_name: data.itinerary_name,
      embark_date: data.embark_date, disembark_date: data.disembark_date, duration_nights: data.duration_nights,
      embark_port: data.embark_port, disembark_port: data.disembark_port,
      pax_adults: data.pax_adults, pax_children: data.pax_children,
      cabin_category: data.cabin_category, cabin_type: data.cabin_type,
      cabin_price_cents: data.cabin_price_cents, taxes_cents: data.taxes_cents, total_cents: data.total_cents,
      pkg_drinks: data.pkg_drinks, pkg_internet: data.pkg_internet, pkg_restaurants: data.pkg_restaurants, pkg_gratuities: data.pkg_gratuities,
      days: withKeys(data.days.map(d => ({ day_number: d.day_number, date: d.date, port: d.port, arrival: d.arrival, departure: d.departure }))),
    }])
    toast.success('Cruzeiro adicionado — revise antes de salvar')
  }

  // "Ler com IA" no bloco Aéreo — cada trecho identificado vira uma nova
  // linha em "Trecho" (append, nunca substitui o que já existe na lista).
  function handleFlightLegsExtracted(legs: ExtractedFlightLeg[]) {
    setFlights(fs => [
      ...fs,
      ...legs.map(leg => ({
        _key: nk(),
        leg_type: leg.leg_type || (fs.length === 0 ? 'outbound' : 'inbound'),
        from_code: leg.from_code, from_city: leg.from_city,
        to_code: leg.to_code, to_city: leg.to_city,
        airline: leg.airline, flight_number: leg.flight_number,
        date: leg.departure_date, departure_time: leg.departure_time,
        arrival_date: leg.arrival_date, arrival_time: leg.arrival_time,
        duration_label: leg.duration_label, stopover_label: leg.stopover_label,
        baggage: leg.baggage, cabin_class: leg.cabin_class,
      })),
    ])
    toast.success(`${legs.length} trecho${legs.length === 1 ? '' : 's'} adicionado${legs.length === 1 ? '' : 's'} — revise antes de salvar`)
  }

  // Autopreenchimento com IA — lê um voucher/orçamento (PDF ou imagem) e
  // preenche os campos da cotação. Não sobrescreve o nome do cliente quando
  // já há um contato vinculado (o nome continua vindo de lá).
  function handleExtracted(data: ExtractedTravelDocument) {
    setQ(s => ({
      ...s,
      client_name: s.contato_id ? s.client_name : (data.cliente || s.client_name),
      destinations: data.destino && !s.destinations.some(d => d.name)
        ? [{ name: data.destino, country: '' }]
        : s.destinations,
      start_date: data.data_ida || s.start_date,
      end_date: data.data_volta || s.end_date,
      operadora: data.operadora || s.operadora,
      total_cents: data.valor_total_cents || s.total_cents,
      total_manual: data.valor_total_cents ? true : s.total_manual,
    }))
    if (data.hotel) {
      setLodgings(ls => ls.length === 0
        ? [{ _key: nk(), name: data.hotel!, photos: [], check_in: data.data_ida, check_out: data.data_volta }]
        : ls.map((l, i) => i === 0 ? { ...l, name: l.name || data.hotel! } : l))
    }
    if (data.voos.length > 0) {
      setFlights(fs => fs.length > 0 ? fs : data.voos.map((v, i) => ({
        _key: nk(),
        leg_type: v.sentido === 'volta' ? 'inbound' : v.sentido === 'ida' ? 'outbound' : (i === 0 ? 'outbound' : 'inbound'),
        airline: v.companhia || undefined,
        date: v.data || undefined,
        from_city: v.origem || undefined,
        to_city: v.destino || undefined,
        baggage: [],
      })))
    }
    toast.success('Campos preenchidos a partir do documento. Revise antes de salvar.')
  }

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

  // Datas da viagem são a fonte única — check-in/check-out de hospedagem e as
  // datas de voo (ida/volta) seguem a data da viagem automaticamente. Só não
  // mexe se o campo já tiver sido customizado pra uma data diferente da viagem
  // (ex.: check-in um dia antes do voo de ida).
  const prevTripDates = useRef({ start: q.start_date, end: q.end_date })
  useEffect(() => {
    const prev = prevTripDates.current
    if (prev.start !== q.start_date) {
      setLodgings(ls => ls.map(l => (!l.check_in || l.check_in === prev.start) ? { ...l, check_in: q.start_date || null } : l))
      setFlights(fs => fs.map(f => f.leg_type === 'outbound' && (!f.date || f.date === prev.start) ? { ...f, date: q.start_date || undefined } : f))
    }
    if (prev.end !== q.end_date) {
      setLodgings(ls => ls.map(l => (!l.check_out || l.check_out === prev.end) ? { ...l, check_out: q.end_date || null } : l))
      setFlights(fs => fs.map(f => f.leg_type === 'inbound' && (!f.date || f.date === prev.end) ? { ...f, date: q.end_date || undefined } : f))
    }
    prevTripDates.current = { start: q.start_date, end: q.end_date }
  }, [q.start_date, q.end_date])

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
    itinerary_html: q.itinerary_html || null,
    flights_html: q.flights_html || null,
    tours_html: q.tours_html || null,
    included: q.included.filter(Boolean), not_included: q.not_included.filter(Boolean),
    price_per_person_cents: q.price_per_person_cents, total_cents: q.total_cents,
    payment_conditions: q.payment_conditions.filter(p => p.label || p.value),
    price_disclaimer: q.price_disclaimer || null, validity_days: q.validity_days,
    operadora: q.operadora || null, commission_total_cents: q.commission_total_cents,
    ...(isOffer ? { offer_published: q.offer_published, offer_category: q.offer_category || null } : {}),
    products: [
      ...lodgings.map(({ _key, name, check_in, check_out, ...rest }) => ({
        product_type: 'hospedagem' as const,
        name: name || null,
        date_start: check_in || null, date_end: check_out || null,
        price_cents: rest.option_total_cents ?? null,
        data: { check_in, check_out, ...rest },
        internal_data: {},
      })),
      ...flights.map(({ _key, ...f }) => ({
        product_type: 'aereo' as const,
        name: [f.from_city || f.from_code, f.to_city || f.to_code].filter(Boolean).join(' → ') || null,
        date_start: f.date || null, date_end: f.arrival_date || f.date || null,
        price_cents: null,
        data: { ...f, duration_label: computeFlightDuration(f) || f.duration_label, baggage: f.baggage as any, cabin_class: (f.cabin_class || null) as any },
        internal_data: {},
      })),
      ...cruises.map(({ _key, days, total_cents, supplier, fare_code, cost_cents, internal_notes, ...c }) => ({
        product_type: 'cruzeiro' as const,
        name: c.ship_name || c.cruise_line || null,
        summary: [c.itinerary_name, c.duration_nights ? `${c.duration_nights} noites` : null].filter(Boolean).join(' · ') || null,
        date_start: c.embark_date || null, date_end: c.disembark_date || null,
        price_cents: total_cents ?? null,
        data: { ...c, total_cents, days: days.map(({ _key: __k, ...d }) => d) },
        internal_data: { supplier, fare_code, cost_cents, internal_notes },
      })),
    ],
    map_pins: pins.filter(p => p.lat != null && p.lng != null).map(p => ({ label: p.label, type: p.type as any, lat: p.lat!, lng: p.lng! })),
  }), [q, lodgings, flights, cruises, pins])

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

  /* ─────── ações ─────── */
  const missing: string[] = []
  if (!q.title) missing.push('título')
  if (!q.start_date) missing.push('data de ida')
  if (!q.price_per_person_cents) missing.push('valor por pessoa')

  // Indicador de completude — só o que é realmente necessário pra uma
  // cotação comercial válida (não bloqueia nada, só orienta o vendedor).
  const completenessChecks: { label: string; done: boolean }[] = [
    { label: 'Título', done: !!q.title },
    { label: 'Destino', done: !!q.destinations[0]?.name },
    { label: 'Datas da viagem', done: !!q.start_date && !!q.end_date },
    { label: 'Passageiros', done: q.pax_adults > 0 },
    { label: 'Pelo menos um produto', done: lodgings.length + flights.length + cruises.length > 0 },
    { label: 'Valor total', done: q.total_cents > 0 },
    { label: 'Forma de pagamento', done: q.payment_conditions.length > 0 },
    { label: 'Validade da tarifa', done: q.validity_days > 0 },
    { label: 'Política de cancelamento', done: !!q.cancellation_html?.trim() },
  ]
  const completeness = Math.round((completenessChecks.filter(c => c.done).length / completenessChecks.length) * 100)
  const missingLabels = completenessChecks.filter(c => !c.done).map(c => c.label)

  // Investimento centraliza o total, mas cada produto pode ter seu próprio
  // valor — mostrado aqui só como referência informativa (o total comercial
  // continua sendo digitado/calculado separadamente, não somado automaticamente,
  // pra não travar cotações com desconto/pacote fechado).
  const productBreakdown = [
    ...lodgings.filter(l => l.option_total_cents != null).map(l => ({ icon: '🏨', label: l.name || 'Hospedagem', price_cents: l.option_total_cents ?? null })),
    ...cruises.map(c => ({ icon: '🚢', label: c.ship_name || c.cruise_line || 'Cruzeiro', price_cents: c.total_cents ?? null })),
  ]

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

  async function onSendToClient() {
    // Garante que o link existe (gera na hora, sem rotacionar).
    let token = publicToken
    if (!token) {
      const res = await generateQuotationLink(orgSlug, q0.id, false)
      if (!res.ok) { toast.error(res.error); return }
      token = res.token
      setPublicToken(token)
      setQ(s => ({ ...s, status: s.status === 'draft' ? 'sent' : s.status }))
    }
    const url = `${window.location.origin}/p/${token}`
    const lead = leads.find(l => l.id === q.contato_id)
    const digits = (lead?.phone || '').replace(/\D/g, '')
    const firstName = (q.client_name || lead?.name || '').trim().split(/\s+/)[0]
    const msg = `Oi${firstName ? ` ${firstName}` : ''}! Preparei sua proposta de viagem${q.title ? ` — ${q.title}` : ''}. Dá uma olhada com carinho: ${url}`
    if (digits) {
      const wa = digits.length <= 11 ? `55${digits}` : digits
      window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
    } else {
      // Sem telefone no contato: abre o WhatsApp sem destinatário (escolhe na hora)
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener')
      if (q.contato_id) toast.info('O contato vinculado não tem telefone — escolha o destinatário no WhatsApp.')
      else toast.info('Nenhum contato vinculado — escolha o destinatário no WhatsApp.')
    }
  }

  async function onConvertToQuotation() {
    setSaleBusy(true)
    await saveQuotation(orgSlug, q0.id, payload)
    const res = await convertOfferToQuotation(orgSlug, q0.id)
    setSaleBusy(false)
    if (res.ok) { toast.success('Oferta copiada para uma nova cotação'); router.push(`/app/${orgSlug}/cotacoes/${res.id}`) }
    else toast.error(res.error)
  }

  async function onConvertToOffer() {
    setSaleBusy(true)
    await saveQuotation(orgSlug, q0.id, payload)
    const res = await convertQuotationToOffer(orgSlug, q0.id)
    setSaleBusy(false)
    if (res.ok) { toast.success('Cotação copiada para uma nova oferta'); router.push(`/app/${orgSlug}/ofertas/${res.id}`) }
    else toast.error(res.error)
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
      setLodgings(ls => ls.map(x => {
        if (x._key !== l._key) return x
        // Descrição: prioriza o texto editorial real do TripAdvisor; se não
        // vier, monta um rascunho com nota/endereço. Só quando o campo ainda
        // está vazio — nunca sobrescreve um texto que o usuário já escreveu.
        const draftParts = [
          res.data.rating && res.data.reviews_count
            ? `Avaliado com nota ${res.data.rating} no TripAdvisor (${res.data.reviews_count} avaliações).`
            : null,
          res.data.address ? `Endereço: ${res.data.address}.` : null,
        ].filter(Boolean)
        const draftDescription = res.data.description
          ? `<p>${res.data.description}</p>`
          : draftParts.length ? `<p>${draftParts.join(' ')}</p>` : x.description_html
        // Fotos: junta as já cadastradas com as novas do TripAdvisor,
        // sem duplicar, até 10 no total — buscar de novo deve trazer mais
        // fotos, não travar em quem já tinha alguma.
        const mergedPhotos = Array.from(new Set([...(x.photos || []), ...((res.data.photos || []) as string[])])).slice(0, 10)
        return {
          ...x,
          // Nome mantido do jeito que o usuário digitou — não sobrescreve
          // com o nome oficial do TripAdvisor.
          tripadvisor_location_id: res.location_id,
          tripadvisor_data: res.data,
          lat: x.lat ?? res.data.lat ?? null,
          lng: x.lng ?? res.data.lng ?? null,
          photos: mergedPhotos,
          description_html: x.description_html?.trim() ? x.description_html : draftDescription,
        }
      }))
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
      <GroupSection id="resumo" active={activeGroup}>
      {/* CAPA */}
      <EditBlock id="blk-capa" icon={ImageIcon} title="Capa">
        <F label="Título (H1 do hero)"><Input value={q.title} onChange={e => setQ(s => ({ ...s, title: e.target.value }))} placeholder="Ex.: Punta Cana, 7 noites à beira-mar" /></F>
        <F label="Subtítulo (H2)"><Input value={q.subtitle} onChange={e => setQ(s => ({ ...s, subtitle: e.target.value }))} placeholder="Ex.: All-inclusive no Caribe — sol, mar e descanso" /></F>
        {isOffer ? (
          <div className="grid grid-cols-2 gap-3">
            <F label="Categoria (vitrine)"><Input value={q.offer_category} onChange={e => setQ(s => ({ ...s, offer_category: e.target.value }))} placeholder="Ex.: Praia, Lua de mel, Nacional" /></F>
            <F label="Publicar na vitrine" hint="aparece no link público da vitrine quando ligado">
              <label className="flex items-center gap-2 h-9 text-sm">
                <Switch checked={q.offer_published} onCheckedChange={v => setQ(s => ({ ...s, offer_published: v }))} />
                {q.offer_published ? 'Publicada' : 'Rascunho (oculta)'}
              </label>
            </F>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <F label="Contato do CRM" hint="liga a cotação ao lead da pipeline (timeline + lead scoring) — o nome do cliente vem daqui">
              <Select value={q.contato_id || 'none'}
                onValueChange={v => setQ(s => {
                  const lead = leads.find(l => l.id === v)
                  return { ...s, contato_id: v === 'none' ? null : v, client_name: v === 'none' ? s.client_name : (lead?.name || s.client_name) }
                })}>
                <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vínculo</SelectItem>
                  {leads.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </F>
            <F label="Nome do cliente" hint={q.contato_id ? 'vem do contato vinculado acima' : undefined}>
              <Input value={q.client_name} disabled={!!q.contato_id}
                onChange={e => setQ(s => ({ ...s, client_name: e.target.value }))} placeholder="Ex.: Ricardo Almeida" />
            </F>
          </div>
        )}
        <F label="Imagem de capa">
          <CoverUpload orgSlug={orgSlug} url={q.cover_image_url} onChange={u => setQ(s => ({ ...s, cover_image_url: u }))}
            unsplashHint={q.destinations[0]?.name || ''} />
        </F>
      </EditBlock>

      {/* VIAGEM */}
      <EditBlock id="blk-viagem" icon={MapPin} title="Viagem">
        <div className="grid grid-cols-2 gap-3">
          <F label="Origem"><Input value={q.origin_label} onChange={e => setQ(s => ({ ...s, origin_label: e.target.value }))} placeholder="Florianópolis" /></F>
          <F label="Destino"><Input placeholder="Ilhéus, Brasil" value={q.destinations[0]?.name || ''}
            onChange={e => setQ(s => ({ ...s, destinations: [{ name: e.target.value, country: '' }] }))} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Data de ida"><Input type="date" value={q.start_date} onChange={e => setQ(s => ({ ...s, start_date: e.target.value }))} /></F>
          <F label="Data de volta"><Input type="date" value={q.end_date} onChange={e => setQ(s => ({ ...s, end_date: e.target.value }))} /></F>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <F label="Adultos"><Input type="number" min={0} value={q.pax_adults} onChange={e => setQ(s => ({ ...s, pax_adults: Math.max(0, parseInt(e.target.value) || 0) }))} /></F>
          <F label="Crianças"><Input type="number" min={0} value={q.pax_children} onChange={e => {
            const n = Math.max(0, parseInt(e.target.value) || 0)
            setQ(s => ({ ...s, pax_children: n, children_ages: s.children_ages.slice(0, n) }))
          }} /></F>
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

      {missingLabels.length > 0 && (
        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Cotação {completeness}% completa</p>
          <p>Faltam: {missingLabels.join(', ')}.</p>
        </div>
      )}
      </GroupSection>

      <GroupSection id="conteudo" active={activeGroup}>
      {/* INTRODUÇÃO */}
      <EditBlock id="blk-intro" icon={Sparkles} title="Introdução">
        <RichField value={q.intro_html} onChange={html => setQ(s => ({ ...s, intro_html: html }))}
          placeholder="Mensagem pessoal de abertura para o cliente (com sua assinatura)…" />
      </EditBlock>

      </GroupSection>

      <GroupSection id="produtos" active={activeGroup}>
      {/* HOSPEDAGENS */}
      <EditBlock id="blk-hospedagens" icon={BedDouble} title="Hospedagens"
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
              <>
                <p className="text-[11px] text-emerald-600">✓ TripAdvisor vinculado{l.tripadvisor_data.rating ? ` · nota ${l.tripadvisor_data.rating}` : ''}{l.tripadvisor_data.reviews_count ? ` · ${l.tripadvisor_data.reviews_count} avaliações` : ''}</p>
                {l.tripadvisor_data.address && (
                  <p className="text-[11px] text-muted-foreground">📍 {l.tripadvisor_data.address}</p>
                )}
              </>
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
            <label className="flex items-center gap-2 text-xs font-medium rounded-lg border p-2.5 bg-muted/20">
              <Switch checked={!!l.is_alternative_option}
                onCheckedChange={v => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, is_alternative_option: v } : x))} />
              Esta é uma opção alternativa (cliente escolhe esta OU outra hospedagem — preços editados em Investimento)
            </label>
          </>
        )} />
      </EditBlock>

      {/* AÉREO */}
      <EditBlock id="blk-aereo" icon={Plane} title="Aéreo"
        action={<div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setFlightOcrOpen(true)}>
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Ler com IA
          </Button>
          <Button type="button" variant="outline" size="sm"
            onClick={() => setFlights(fs => [...fs, { _key: nk(), leg_type: fs.length === 0 ? 'outbound' : 'inbound', baggage: [] }])}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Trecho
          </Button>
        </div>}>
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
              <F label="Código do voo"><Input placeholder="LA3380; LA3385" value={f.flight_number || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, flight_number: e.target.value } : x))} /></F>
              <F label="Duração" hint={computeFlightDuration(f) ? 'calculada automaticamente' : undefined}>
                {computeFlightDuration(f) ? (
                  <Input disabled value={computeFlightDuration(f) || ''} />
                ) : (
                  <Input placeholder="≈ 12h total" value={f.duration_label || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, duration_label: e.target.value } : x))} />
                )}
              </F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Cidade origem"><Input placeholder="Florianópolis" value={f.from_city || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, from_city: e.target.value } : x))} /></F>
              <F label="Origem (sigla)"><Input placeholder="FLN" maxLength={4} value={f.from_code || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, from_code: e.target.value.toUpperCase() } : x))} /></F>
              <F label="Cidade destino"><Input placeholder="Punta Cana" value={f.to_city || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, to_city: e.target.value } : x))} /></F>
              <F label="Destino (sigla)"><Input placeholder="PUJ" maxLength={4} value={f.to_code || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, to_code: e.target.value.toUpperCase() } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Data de partida"><Input type="date" className="w-full" value={f.date || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, date: e.target.value } : x))} /></F>
              <F label="Hora de partida"><Input type="time" className="w-full" value={f.departure_time || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, departure_time: e.target.value } : x))} /></F>
              <F label="Data de chegada"><Input type="date" className="w-full" value={f.arrival_date || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, arrival_date: e.target.value } : x))} /></F>
              <F label="Hora de chegada"><Input type="time" className="w-full" value={f.arrival_time || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, arrival_time: e.target.value } : x))} /></F>
            </div>
            <F label="Conexão (local + tempo de espera)"><Input placeholder="Panamá (PTY) — 2h35 de conexão" value={f.stopover_label || ''} onChange={e => setFlights(fs => fs.map(x => x._key === f._key ? { ...x, stopover_label: e.target.value } : x))} /></F>
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
              <F label="Cabine — categoria"><Input placeholder="Balcony" value={c.cabin_category || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_category: e.target.value } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <F label="Porto de embarque"><Input placeholder="Miami" value={c.embark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, embark_port: e.target.value } : x))} /></F>
              <F label="Porto de desembarque"><Input placeholder="Miami" value={c.disembark_port || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, disembark_port: e.target.value } : x))} /></F>
              <F label="Adultos"><Input type="number" min={0} value={c.pax_adults ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_adults: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
              <F label="Crianças"><Input type="number" min={0} value={c.pax_children ?? ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, pax_children: e.target.value ? parseInt(e.target.value) : null } : x))} /></F>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <F label="Valor da cabine (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.cabin_price_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_price_cents: strToCents(e.target.value) } : x))} /></F>
              <F label="Taxas (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.taxes_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, taxes_cents: strToCents(e.target.value) } : x))} /></F>
              <F label="Total do produto (R$)"><Input inputMode="decimal" placeholder="0,00" defaultValue={centsToStr(c.total_cents)} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, total_cents: strToCents(e.target.value) } : x))} /></F>
            </div>

            {/* Recomendado */}
            <Disclosure label="Mais detalhes da cabine e pacotes">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <F label="Tipo de cabine"><Input placeholder="Varanda" value={c.cabin_type || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, cabin_type: e.target.value } : x))} /></F>
                <F label="Deck"><Input placeholder="9" value={c.deck || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, deck: e.target.value } : x))} /></F>
                <F label="Localização"><Input placeholder="Meio do navio" value={c.location || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, location: e.target.value } : x))} /></F>
                <F label="Vista"><Input placeholder="Mar" value={c.view || ''} onChange={e => setCruises(cs => cs.map(x => x._key === c._key ? { ...x, view: e.target.value } : x))} /></F>
              </div>
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
      </GroupSection>

      <GroupSection id="conteudo" active={activeGroup}>
      {/* MAPA */}
      <EditBlock id="blk-mapa" icon={MapIcon} title="Mapa"
        action={<Button type="button" variant="outline" size="sm"
          onClick={() => setPins(ps => [...ps, { _key: nk(), label: '', type: 'attraction' }])}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Pin
        </Button>}>
        <p className="text-[11px] text-muted-foreground">O mapa da cotação mostra só os pins adicionados aqui — inclua hospedagens, atrações e aeroporto manualmente.</p>
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

      {/* ITINERÁRIO — texto livre rico (fonte, cor, imagens) */}
      <EditBlock id="blk-itinerario" icon={Route} title="Itinerário">
        <p className="text-[11px] text-muted-foreground">
          Escreva o roteiro do jeito que preferir. Formate a letra (fonte, tamanho, cor),
          e insira imagens pelo botão, colando (Ctrl+V) ou arrastando para o texto.
        </p>
        <ItineraryEditor orgSlug={orgSlug} value={q.itinerary_html}
          onChange={html => setQ(s => ({ ...s, itinerary_html: html }))} />
      </EditBlock>

      {/* PASSEIOS E INGRESSOS — texto livre rico, mesmo padrão do Itinerário */}
      <EditBlock id="blk-passeios" icon={Ticket} title="Passeios e Ingressos">
        <p className="text-[11px] text-muted-foreground">
          Descreva passeios, ingressos de parques etc. Cole prints (Ctrl+V) ou arraste
          imagens, e formate o texto como preferir.
        </p>
        <ItineraryEditor orgSlug={orgSlug} value={q.tours_html}
          onChange={html => setQ(s => ({ ...s, tours_html: html }))} />
      </EditBlock>

      {/* IMPORTANTE */}
      <EditBlock id="blk-importante" icon={AlertTriangle} title="Importante">
        <RichField value={q.important_html} onChange={html => setQ(s => ({ ...s, important_html: html }))}
          placeholder="Documentos, vacinas, clima, seguro, dicas — o que o cliente precisa saber antes de fechar…" />
      </EditBlock>

      {/* O QUE INCLUI */}
      <EditBlock id="blk-inclui" icon={CheckCircle2} title="O que inclui">
        <div className="grid sm:grid-cols-2 gap-4">
          <F label="Incluso"><StringList items={q.included} placeholder="Passagem aérea ida e volta" suggestions={INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, included: v }))} /></F>
          <F label="Não incluso"><StringList items={q.not_included} placeholder="Seguro viagem" suggestions={NOT_INCLUDED_SUGGESTIONS} onChange={v => setQ(s => ({ ...s, not_included: v }))} /></F>
        </div>
      </EditBlock>

      {/* POLÍTICAS DE CANCELAMENTO */}
      <EditBlock id="blk-cancelamento" icon={AlertTriangle} title="Políticas de cancelamento">
        <RichField value={q.cancellation_html} onChange={html => setQ(s => ({ ...s, cancellation_html: html }))}
          placeholder="Condições de alteração, cancelamento e reembolso — escreva do jeito que preferir…" />
      </EditBlock>
      </GroupSection>

      <GroupSection id="investimento" active={activeGroup}>
      {/* INVESTIMENTO */}
      <EditBlock id="blk-investimento" icon={Wallet} title="Investimento">
        {productBreakdown.length > 0 && (
          <div className="rounded-lg border bg-muted/20 p-2.5 space-y-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produtos da viagem</p>
            {productBreakdown.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate">{p.icon} {p.label}</span>
                <span className="tabular-nums shrink-0">{p.price_cents != null ? centsToStr(p.price_cents).replace(/^/, 'R$ ') : '—'}</span>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground pt-1 border-t">O total abaixo continua sendo o valor comercial final — pode diferir da soma dos produtos (descontos, arredondamento, etc.).</p>
          </div>
        )}
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
        {lodgings.some(l => l.is_alternative_option) && (
          <F label="Opções de hospedagem alternativa" hint="preço de cada opção — aparece na Vitrine como cards separados">
            <div className="space-y-2">
              {lodgings.filter(l => l.is_alternative_option).map((l, i) => (
                <div key={l._key} className="rounded-lg border p-2.5 grid grid-cols-[1fr_1fr_1fr] gap-2 items-end">
                  <span className="text-xs font-medium text-muted-foreground truncate col-span-3 sm:col-span-1">
                    Opção {i + 1} · {l.name || 'sem nome'}
                  </span>
                  <F label="Por pessoa">
                    <Input placeholder="0,00" value={centsToStr(l.option_price_per_person_cents)}
                      onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, option_price_per_person_cents: strToCents(e.target.value) } : x))} />
                  </F>
                  <F label="Total">
                    <Input placeholder="0,00" value={centsToStr(l.option_total_cents)}
                      onChange={e => setLodgings(ls => ls.map(x => x._key === l._key ? { ...x, option_total_cents: strToCents(e.target.value) } : x))} />
                  </F>
                </div>
              ))}
            </div>
          </F>
        )}
        <F label="Formas de pagamento">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map(m => {
                const active = q.payment_conditions.some(p => p.label === m.label)
                const Icon = m.icon
                return (
                  <button key={m.label} type="button"
                    onClick={() => setQ(s => ({
                      ...s,
                      payment_conditions: active
                        ? s.payment_conditions.filter(p => p.label !== m.label)
                        : [...s.payment_conditions, { label: m.label, value: '' }],
                    }))}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors ${
                      active ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:bg-muted'
                    }`}>
                    <Icon className="w-4 h-4" /> {m.label}
                  </button>
                )
              })}
            </div>
            {PAYMENT_METHODS.filter(m => q.payment_conditions.some(p => p.label === m.label)).map(m => {
              const cond = q.payment_conditions.find(p => p.label === m.label)
              return (
                <div key={m.label} className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground w-28 shrink-0">{m.label}</span>
                  <Input className="flex-1" placeholder={m.placeholder} value={cond?.value || ''}
                    onChange={e => setQ(s => ({
                      ...s,
                      payment_conditions: s.payment_conditions.map(p => p.label === m.label ? { ...p, value: e.target.value } : p),
                    }))} />
                </div>
              )
            })}
          </div>
        </F>
        <F label="Disclaimer"><Textarea rows={2} placeholder="Preços sujeitos a alteração sem aviso prévio…" value={q.price_disclaimer}
          onChange={e => setQ(s => ({ ...s, price_disclaimer: e.target.value }))} /></F>
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <F label="Operadora (interno)"><Input value={q.operadora} onChange={e => setQ(s => ({ ...s, operadora: e.target.value }))} placeholder="Não aparece na proposta" /></F>
          <F label="Comissão total (interno)"><Input inputMode="decimal" defaultValue={centsToStr(q.commission_total_cents)}
            onChange={e => setQ(s => ({ ...s, commission_total_cents: strToCents(e.target.value) }))} /></F>
        </div>
      </EditBlock>
      </GroupSection>

      <GroupSection id="fechamento" active={activeGroup}>
      {/* FECHAMENTO */}
      <EditBlock id="blk-fechamento" icon={MessageCircle} title="Fechamento">
        <RichField value={q.closing_html} onChange={html => setQ(s => ({ ...s, closing_html: html }))}
          placeholder="Texto final de convite à reserva (título + parágrafo)…" minH={80} />
        <p className="text-[11px] text-muted-foreground">
          Os botões de WhatsApp usam o número configurado da agência
          {initial.org_settings?.whatsapp_number ? ` (${initial.org_settings.whatsapp_number})` : ' — nenhum configurado'}.
          {' '}Rodapé e white-label vêm das{' '}
          <Link href={`/app/${orgSlug}/configuracoes/organizacoes`} className="underline">configurações da agência</Link>.
        </p>
      </EditBlock>
      </GroupSection>
    </div>
  )

  return (
    <div className="pb-8">
      {/* Toolbar + navegação entre blocos — um único bloco sticky, sem espaço entre as duas linhas */}
      <div style={{ top: -20 }} className="sticky z-20 -mx-3 sm:-mx-5 -mt-5 bg-background/95 backdrop-blur border-b">
      <div className="px-3 sm:px-5 py-2.5 flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/app/${orgSlug}/cotacoes`}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Link>
        </Button>
        <span className="text-sm font-semibold truncate flex-1 min-w-[120px]">{q.title || 'Nova cotação'}</span>
        <Button type="button" variant="outline" size="sm" onClick={() => setExtractOpen(true)}>
          <Sparkles className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Autopreencher com IA</span>
        </Button>
        {!isOffer && (
          <Button type="button" variant="outline" size="sm" asChild>
            <a href={`/app/${orgSlug}/cotacoes/${q0.id}/pdf`} target="_blank" rel="noopener noreferrer">
              <FileText className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Gerar PDF</span>
            </a>
          </Button>
        )}
        <span className={`text-[11px] ${saveState === 'error' ? 'text-destructive' : 'text-muted-foreground'}`}>
          {saveState === 'saving' ? 'Salvando…' : saveState === 'saved' ? '✓ Salvo' : saveState === 'error' ? 'Erro ao salvar' : ''}
        </span>
        {publicUrl && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={async () => {
              try { await navigator.clipboard.writeText(window.location.origin + publicUrl); toast.success('Link copiado') } catch { toast.error('Não foi possível copiar') }
            }}><Copy className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Copiar link</span></Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Abrir</span></a>
            </Button>
            {!isOffer && (
              <Button type="button" size="sm" className="bg-[#25D366] hover:bg-[#1eb959] text-[#0a3d22]" onClick={onSendToClient}>
                <MessageCircle className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Enviar ao cliente</span>
              </Button>
            )}
          </>
        )}
        {!publicToken && (
          <Button type="button" size="sm" onClick={() => onGenerateLink(false)}>
            <Link2 className="w-3.5 h-3.5 mr-1" /> Gerar link
          </Button>
        )}
        {isOffer ? (
          <Button type="button" size="sm" variant="secondary" onClick={onConvertToQuotation} disabled={saleBusy}>
            {saleBusy ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <FileText className="w-3.5 h-3.5 sm:mr-1" />}
            <span className="hidden sm:inline">Converter em cotação</span>
          </Button>
        ) : (
          <>
            <Button type="button" size="sm" variant="outline" onClick={onConvertToOffer} disabled={saleBusy}>
              <ShoppingBag className="w-3.5 h-3.5 sm:mr-1" /><span className="hidden sm:inline">Transformar em oferta</span>
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={onGenerateSale} disabled={saleBusy}>
              {saleBusy ? <Loader2 className="w-3.5 h-3.5 sm:mr-1 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5 sm:mr-1" />}
              <span className="hidden sm:inline">Gerar venda</span>
            </Button>
          </>
        )}
      </div>
      <GroupNavMobile active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
      </div>

      <div className="mt-[3px] flex gap-4 items-start">
        <GroupNavSidebar active={activeGroup} onChange={setActiveGroup} completeness={completeness} />
        <div className="flex-1 min-w-0 max-w-4xl">{form}</div>
      </div>

      <DocumentExtractDialog
        orgSlug={orgSlug}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        title="Autopreencher com IA"
        description="Envie o voucher/orçamento (PDF ou imagem) — a IA lê o documento e preenche cliente, destino, datas, hospedagem, voos e valor. Revise antes de salvar."
        onApply={data => handleExtracted(data)}
      />

      <FlightOcrDialog
        orgSlug={orgSlug}
        open={flightOcrOpen}
        onOpenChange={setFlightOcrOpen}
        onApply={legs => handleFlightLegsExtracted(legs)}
      />

      <CruiseOcrDialog
        orgSlug={orgSlug}
        open={cruiseOcrOpen}
        onOpenChange={setCruiseOcrOpen}
        onApply={data => handleCruiseExtracted(data)}
      />
    </div>
  )
}
