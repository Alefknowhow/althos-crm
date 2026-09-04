'use client'

/**
 * Blocos de UI reutilizáveis do editor de Cotação — extraídos de
 * QuotationEditor.tsx (que ficou grande demais). Nenhum destes componentes
 * depende do estado do formulário principal; todos recebem valor/onChange
 * por props, então a extração não muda nenhum export público do editor.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS as DndCSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import {
  Plus, Trash2, GripVertical,
  Wallet, FileEdit, MessageCircle, ChevronDown, ShoppingBag,
  LayoutGrid, CreditCard, QrCode, Receipt,
} from 'lucide-react'
import { uploadFormAsset } from '@/actions/upload'
import ItineraryEditor from '@/components/features/proposals/ItineraryEditor'

export { CoverUpload, SignaturePhotoUpload, UnsplashPicker, PhotoGallery } from './QuotationEditorMedia'

// Métodos de pagamento pré-dispostos (toggle on/off como as bagagens).
export const FARE_CONDITIONS = [
  { key: 'nao_reembolsavel', label: 'Não reembolsável' },
  { key: 'alteracao_com_custo', label: 'Permite alteração com custo' },
  { key: 'nao_permite_alteracao', label: 'Não permite alteração' },
] as const

export const PAYMENT_METHODS = [
  { label: 'Pix', icon: QrCode, placeholder: 'Ex.: à vista' },
  { label: 'Cartão de crédito', icon: CreditCard, placeholder: 'Ex.: até 12x sem juros' },
  { label: 'Boleto', icon: Receipt, placeholder: 'Ex.: entrada + saldo em 2x' },
] as const

export const INCLUDED_SUGGESTIONS = [
  'Aéreo ida e volta', 'Bagagem (23kg)', 'Bagagem de mão (10kg)', 'Marcação de assentos',
  'Taxas e impostos', 'Transfer aeroporto ⇄ hotel', 'Café da manhã', 'Seguro viagem',
  'Hospedagem', 'Passeios mencionados', 'Assistência 24h',
]
export const NOT_INCLUDED_SUGGESTIONS = [
  'Bagagem despachada', 'Marcação de assentos', 'Taxas e impostos locais', 'Transfer',
  'Passeios não citados', 'Refeições não mencionadas', 'Despesas pessoais', 'Seguro viagem',
  'Gorjetas', 'Vistos e documentação',
]

export const BOARD_OPTIONS = ['Somente Quarto', 'Café da manhã', 'Meia pensão', 'Pensão completa', 'All inclusive']

/* ═════════════ helpers ═════════════ */
let keySeq = 0
export const nk = () => `k${Date.now().toString(36)}${(keySeq++).toString(36)}`
export const withKeys = <T extends object>(rows: T[]): (T & { _key: string })[] =>
  rows.map(r => ({ ...(r as any), _key: nk() }))

export function centsToStr(c?: number | null) {
  return c ? (c / 100).toFixed(2).replace('.', ',') : ''
}
export function strToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Duração do trecho calculada a partir de partida/chegada — só quando
 *  data+hora de ambos os lados estão preenchidos; senão fica null (o
 *  campo cai de volta pro texto digitado à mão, ex.: "≈ 12h total"). */
export function computeFlightDuration(f: { date?: string | null; departure_time?: string | null; arrival_date?: string | null; arrival_time?: string | null }): string | null {
  if (!f.date || !f.departure_time || !f.arrival_time) return null
  const dep = new Date(`${f.date}T${f.departure_time}`)
  const arr = new Date(`${f.arrival_date || f.date}T${f.arrival_time}`)
  if (Number.isNaN(dep.getTime()) || Number.isNaN(arr.getTime())) return null
  const diffMin = Math.round((arr.getTime() - dep.getTime()) / 60000)
  if (diffMin <= 0) return null
  const h = Math.floor(diffMin / 60)
  const m = diffMin % 60
  return m > 0 ? `${h}h${m}min` : `${h}h`
}

export async function compressAndUpload(orgSlug: string, file: File): Promise<string | null> {
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

export function hasHtml(html?: string | null): boolean {
  return !!html && html.replace(/<[^>]*>/g, '').trim() !== ''
}

/** Bloco de texto rico com toggle ativar/desativar — mesmo padrão do
 *  "Alternativa: descrever o aéreo em texto livre" em Produtos. Desligar
 *  limpa o conteúdo (senão fica escondido mas ainda preenchido, e a seção
 *  continuaria aparecendo na proposta). Editor com toolbar completa
 *  (negrito/itálico/sublinhado/título/lista/alinhamento/imagem/desfazer),
 *  igual ao Itinerário. */
export function ToggleRichField({ orgSlug, value, onChange }: { orgSlug: string; value: string; onChange: (html: string) => void }) {
  const [open, setOpen] = useState(() => hasHtml(value))
  return (
    <>
      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
        <Switch checked={open} onCheckedChange={v => { setOpen(v); if (!v) onChange('') }} />
        {open ? 'Ativo — aparece na proposta' : 'Inativo — não aparece na proposta'}
      </label>
      {open && <div className="mt-2"><ItineraryEditor orgSlug={orgSlug} value={value} onChange={onChange} /></div>}
    </>
  )
}

/* ═════════════ dnd-kit: item ordenável genérico ═════════════ */
export function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
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

export function SortableList<T extends { _key: string }>({
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
export function F({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground/80">{hint}</p>}
    </div>
  )
}

export function EditBlock({ id, icon: Icon, title, children, action }: { id?: string; icon: any; title: string; children: React.ReactNode; action?: React.ReactNode }) {
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
export const GROUPS = [
  { id: 'resumo', label: 'Resumo', icon: LayoutGrid },
  { id: 'produtos', label: 'Produtos', icon: ShoppingBag },
  { id: 'conteudo', label: 'Conteúdo', icon: FileEdit },
  { id: 'investimento', label: 'Investimento', icon: Wallet },
  { id: 'fechamento', label: 'Fechamento', icon: MessageCircle },
] as const
export type GroupId = (typeof GROUPS)[number]['id']

/** Nav horizontal — só no mobile, onde uma barra lateral fixa não cabe. */
export function GroupNavMobile({ active, onChange, completeness }: { active: GroupId; onChange: (g: GroupId) => void; completeness: number }) {
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
export function GroupNavSidebar({ active, onChange, completeness }: { active: GroupId; onChange: (g: GroupId) => void; completeness: number }) {
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
export function GroupSection({ id, active, children }: { id: GroupId; active: GroupId; children: React.ReactNode }) {
  if (id !== active) return null
  return <>{children}</>
}

/** Disclosure simples pra separar campos Recomendado/Avançado dos
 *  Essenciais — não polui a interface principal, mas fica a 1 clique. */
export function Disclosure({ label, children, defaultOpen = false }: { label: string; children: React.ReactNode; defaultOpen?: boolean }) {
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
export function StringList({ items, onChange, placeholder, suggestions }: {
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

export { BaggagePicker } from './QuotationEditorMedia'
