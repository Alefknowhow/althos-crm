'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Upload, Loader2, Sparkles, FileIcon, ImageIcon, X, CheckCircle2, AlertTriangle,
} from 'lucide-react'
import { uploadSaleVoucher } from '@/actions/upload'
import { extractTravelDocument } from '@/actions/document-extract'
import { bulkCreateSaleProductsFromExtraction } from '@/actions/sale-products'
import type { ExtractedTravelDocument } from '@/lib/ai/document-extract'
import type { TravelSaleRow } from '@/actions/travel-sales'

type Voucher = { url: string; name: string }

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

type ProductItem = { kind: string; label: string; sub: string; checked: boolean; ref: any }
type PendingFile = { file: File; name: string }

/**
 * Upload de voucher (aceita mais de um) + botão explícito "Ler dados com IA"
 * por arquivo + tela de revisão. O voucher continua sendo anexado
 * normalmente (vouchers[] da venda) — esta tela só cuida de ler os dados e
 * transformar em produtos estruturados (sale_products), sem duplicar
 * digitação. Os 3 campos financeiros continuam manuais — a extração nunca
 * tenta inferi-los.
 */
export default function VoucherUploadAndReview({
  orgSlug, sale, onVoucherAdded, onScalarFieldsExtracted, onProductsCreated,
}: {
  orgSlug: string
  sale: TravelSaleRow
  onVoucherAdded: (v: Voucher) => void
  onScalarFieldsExtracted: (patch: Record<string, any>) => void
  onProductsCreated: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [extractingFor, setExtractingFor] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedTravelDocument | null>(null)
  const [items, setItems] = useState<ProductItem[]>([])
  const [confirming, setConfirming] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    const newlyUploaded: PendingFile[] = []
    for (const file of Array.from(files)) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await uploadSaleVoucher(orgSlug, fd)
      if (res.ok) { onVoucherAdded({ url: res.url, name: res.name }); newlyUploaded.push({ file, name: res.name }) }
      else toast.error(`${file.name}: ${res.error}`)
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
    setPendingFiles(prev => [...prev, ...newlyUploaded])
  }

  async function runExtraction(pf: PendingFile) {
    setExtractingFor(pf.name)
    setExtracted(null)
    try {
      const base64 = await fileToBase64(pf.file)
      const res = await extractTravelDocument(orgSlug, { base64, mediaType: pf.file.type })
      if (!res.ok) { toast.error(res.error); return }
      const data: ExtractedTravelDocument = res.data
      setExtracted(data)
      const newItems: ProductItem[] = []
      for (const v of data.voos || []) newItems.push({ kind: 'aereo', label: `✈️ ${v.companhia || 'Aéreo'} (${v.sentido === 'volta' ? 'volta' : 'ida'})`, sub: [v.origem, v.destino].filter(Boolean).join(' → ') + (v.data ? ` · ${v.data}${v.horario ? ` ${v.horario}` : ''}` : ''), checked: true, ref: v })
      for (const h of data.hospedagens || []) newItems.push({ kind: 'hospedagem', label: `🏨 ${h.nome || 'Hospedagem'}`, sub: h.check_in && h.check_out ? `${h.check_in} → ${h.check_out}` : '', checked: true, ref: h })
      for (const c of data.cruzeiros || []) newItems.push({ kind: 'cruzeiro', label: `🚢 ${c.navio || c.companhia || 'Cruzeiro'}`, sub: c.roteiro || '', checked: true, ref: c })
      for (const t of data.transfers || []) newItems.push({ kind: 'transfer', label: `🚐 Transfer`, sub: [t.origem, t.destino].filter(Boolean).join(' → '), checked: true, ref: t })
      for (const s of data.seguros || []) newItems.push({ kind: 'seguro', label: `🛡️ ${s.seguradora || 'Seguro'}`, sub: s.plano || '', checked: true, ref: s })
      setItems(newItems)
    } finally {
      setExtractingFor(null)
    }
  }

  function toggleItem(i: number) {
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, checked: !it.checked } : it))
  }

  async function handleConfirm() {
    if (!extracted) return
    setConfirming(true)

    const scalarPatch: Record<string, any> = {}
    if (extracted.cliente) scalarPatch.client_name = sale.client_name || extracted.cliente
    if (extracted.destino) scalarPatch.destination = extracted.destino
    if (extracted.operadora) scalarPatch.operator = extracted.operadora
    if (extracted.localizador_pacote) scalarPatch.package_locator = extracted.localizador_pacote
    if (extracted.localizador_aereo) scalarPatch.air_locator = extracted.localizador_aereo
    if (extracted.data_ida) scalarPatch.departure_date = extracted.data_ida
    if (extracted.data_volta) scalarPatch.return_date = extracted.data_volta
    if (extracted.politica_cancelamento) scalarPatch.cancellation_policy = extracted.politica_cancelamento
    if (extracted.informacoes_importantes) scalarPatch.important_info = extracted.informacoes_importantes
    if (extracted.informacoes_servico) scalarPatch.service_info = extracted.informacoes_servico
    onScalarFieldsExtracted(scalarPatch)

    // Só cria produtos dos itens marcados — filtra o documento antes de
    // chamar a action em lote (que consome o shape inteiro).
    const filtered: ExtractedTravelDocument = {
      ...extracted,
      voos: items.filter(i => i.kind === 'aereo' && i.checked).map(i => i.ref),
      hospedagens: items.filter(i => i.kind === 'hospedagem' && i.checked).map(i => i.ref),
      cruzeiros: items.filter(i => i.kind === 'cruzeiro' && i.checked).map(i => i.ref),
      transfers: items.filter(i => i.kind === 'transfer' && i.checked).map(i => i.ref),
      seguros: items.filter(i => i.kind === 'seguro' && i.checked).map(i => i.ref),
    }

    const res = await bulkCreateSaleProductsFromExtraction(orgSlug, sale.id, filtered)
    setConfirming(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`${res.created} produto(s) criado(s) a partir do voucher.`)
    setExtracted(null)
    setItems([])
    onProductsCreated()
  }

  const identifiedCount = extracted ? [
    extracted.cliente, extracted.destino, extracted.operadora, extracted.localizador_pacote,
    extracted.localizador_aereo, extracted.data_ida, extracted.data_volta,
  ].filter(Boolean).length + items.length : 0

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      <div className="rounded-lg border-2 border-dashed p-4 text-center space-y-2">
        <Upload className="w-5 h-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Adicionar voucher</p>
        <p className="text-xs text-muted-foreground">PDF, JPG ou PNG — aceita mais de um arquivo por reserva.</p>
        <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
          {uploading ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Enviando…</> : <><Upload className="w-3.5 h-3.5 mr-1.5" /> Selecionar arquivo</>}
        </Button>
      </div>

      {pendingFiles.length > 0 && (
        <div className="space-y-1.5">
          {pendingFiles.map((pf, i) => {
            const isPdf = /\.pdf$/i.test(pf.name)
            const busy = extractingFor === pf.name
            return (
              <div key={`${pf.name}-${i}`} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                <span className="flex-1 min-w-0 truncate text-sm">{pf.name}</span>
                <Button type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0" disabled={busy} onClick={() => runExtraction(pf)}>
                  {busy ? <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Lendo…</> : <><Sparkles className="w-3.5 h-3.5 mr-1" /> Ler dados</>}
                </Button>
              </div>
            )
          })}
        </div>
      )}

      {extracted && (
        <div className="rounded-lg border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-primary" /> Dados identificados
            </p>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setExtracted(null); setItems([]) }}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{identifiedCount} dado(s) identificado(s) — revise antes de confirmar.</p>

          <div className="flex flex-wrap gap-1.5">
            {extracted.cliente && <Badge variant="secondary" className="gap-1 text-[11px]"><CheckCircle2 className="w-3 h-3" /> Cliente: {extracted.cliente}</Badge>}
            {extracted.destino && <Badge variant="secondary" className="gap-1 text-[11px]"><CheckCircle2 className="w-3 h-3" /> Destino: {extracted.destino}</Badge>}
            {extracted.operadora && <Badge variant="secondary" className="gap-1 text-[11px]"><CheckCircle2 className="w-3 h-3" /> Operadora: {extracted.operadora}</Badge>}
            {!extracted.data_ida && !extracted.data_volta && (
              <Badge variant="outline" className="gap-1 text-[11px] text-amber-600 border-amber-300"><AlertTriangle className="w-3 h-3" /> Datas: revisar</Badge>
            )}
          </div>

          <Badge variant="outline" className="gap-1 text-[11px]">Manual: valor total, comissão e retido</Badge>

          {items.length > 0 && (
            <div className="space-y-1.5 pt-2 border-t">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Produtos identificados</p>
              {items.map((it, i) => (
                <label key={i} className="flex items-center gap-2.5 rounded-md border px-2.5 py-1.5 cursor-pointer hover:bg-muted/40">
                  <input type="checkbox" className="accent-primary w-4 h-4" checked={it.checked} onChange={() => toggleItem(i)} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm truncate">{it.label}</div>
                    {it.sub && <div className="text-[11px] text-muted-foreground truncate">{it.sub}</div>}
                  </div>
                </label>
              ))}
            </div>
          )}

          <Button type="button" className="w-full" disabled={confirming} onClick={handleConfirm}>
            {confirming ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Confirmando…</> : 'Confirmar e criar produtos'}
          </Button>
        </div>
      )}
    </div>
  )
}
