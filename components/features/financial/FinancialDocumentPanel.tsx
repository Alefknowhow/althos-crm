'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Upload, Loader2, Sparkles, FileIcon, ImageIcon, X, AlertTriangle } from 'lucide-react'
import { extractFinancialDocument } from '@/actions/document-extract'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'

const ACCEPTED_MIME = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']

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

/**
 * Anexo + "Ler com IA" embutidos no formulário de lançamento (criação ou
 * edição) — ver seções 14-17 do prompt de refatoração do Financeiro. Roda
 * ANTES do lançamento existir (extractFinancialDocument não precisa de
 * entryId, diferente de uploadFinancialAttachment): o arquivo escolhido
 * aqui é só devolvido ao formulário pai via onFileSelected; quem sobe de
 * fato pro storage é o caller, depois que o lançamento é criado/salvo.
 * A IA nunca salva sozinha — só preenche os campos, o usuário revisa e
 * confirma ao clicar em criar/salvar.
 */
export default function FinancialDocumentPanel({
  orgSlug, file, onFileSelected, onExtracted,
}: {
  orgSlug: string
  file: File | null
  onFileSelected: (f: File | null) => void
  onExtracted: (data: ExtractedFinancialDocument) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [extracting, setExtracting] = useState(false)
  const [extractedOnce, setExtractedOnce] = useState(false)

  function handlePick(f: File | null) {
    if (!f) { onFileSelected(null); setExtractedOnce(false); return }
    if (!ACCEPTED_MIME.includes(f.type)) { toast.error('Formato não suportado. Use PDF, JPG, PNG, WebP ou GIF.'); return }
    if (f.size > 15 * 1024 * 1024) { toast.error('Arquivo muito grande. O limite é 15 MB.'); return }
    onFileSelected(f)
    setExtractedOnce(false)
  }

  async function handleReadWithAi() {
    if (!file) return
    setExtracting(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await extractFinancialDocument(orgSlug, { base64, mediaType: file.type })
      if (!res.ok) { toast.error(res.error); return }
      onExtracted(res.data)
      setExtractedOnce(true)
      toast.success('Documento analisado. Revise os dados antes de salvar.')
    } catch (e: any) {
      toast.error('Não foi possível processar o documento. Tente novamente.', { description: e?.message })
    } finally {
      setExtracting(false)
    }
  }

  return (
    <div className="space-y-2">
      {!file ? (
        <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-lg py-5 px-3 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.gif,application/pdf,image/*"
            className="hidden"
            onChange={e => handlePick(e.target.files?.[0] ?? null)}
          />
          <Upload className="w-5 h-5 text-muted-foreground" />
          <p className="text-xs font-medium">Arraste o arquivo aqui ou clique para selecionar</p>
          <p className="text-[11px] text-muted-foreground">PDF ou imagem (nota fiscal, boleto, recibo) — até 15 MB</p>
        </label>
      ) : (
        <div className="rounded-lg border p-2.5 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            {file.type === 'application/pdf' ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
            <span className="truncate flex-1">{file.name}</span>
            <span className="text-muted-foreground shrink-0">{(file.size / 1024).toFixed(0)} KB</span>
            <button type="button" onClick={() => handlePick(null)} className="shrink-0 text-muted-foreground hover:text-destructive" aria-label="Remover arquivo">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {extracting ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Lendo documento…</p>
          ) : extractedOnce ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Documento analisado — confira os campos preenchidos abaixo antes de salvar.</p>
          ) : (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleReadWithAi}>
              <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Ler com IA
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
