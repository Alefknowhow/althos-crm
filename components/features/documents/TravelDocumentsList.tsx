'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileText, Upload, Loader2, Printer, ExternalLink, Trash2 } from 'lucide-react'
import {
  uploadOrgDocument, deleteOrgDocument, getOrgDocumentSignedUrl, type OrgDocument,
} from '@/actions/org-documents'

function fmtSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR')
}

export default function TravelDocumentsList({ orgSlug, initial }: { orgSlug: string; initial: OrgDocument[] }) {
  const [docs, setDocs] = useState<OrgDocument[]>(initial)
  const [label, setLabel] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  const [openDoc, setOpenDoc] = useState<{ doc: OrgDocument; url: string } | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [printingId, setPrintingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<OrgDocument | null>(null)
  const printFrameRef = useRef<HTMLIFrameElement>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!label.trim()) { toast.error('Informe um rótulo para o documento.'); return }
    if (!file) { toast.error('Selecione um arquivo PDF.'); return }
    setUploading(true)
    const fd = new FormData()
    fd.append('label', label.trim())
    fd.append('file', file)
    const res = await uploadOrgDocument(orgSlug, fd)
    setUploading(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Documento adicionado.')
    setLabel('')
    if (fileRef.current) fileRef.current.value = ''
    // Recarrega a lista simplesmente re-navegando não é necessário — a
    // action já revalida o path; refetch client-side evita esperar o RSC.
    window.location.reload()
  }

  async function handleOpen(doc: OrgDocument) {
    setOpeningId(doc.id)
    const res = await getOrgDocumentSignedUrl(orgSlug, doc.id)
    setOpeningId(null)
    if (!res.ok) { toast.error(res.error); return }
    setOpenDoc({ doc, url: res.url })
  }

  async function handlePrint(doc: OrgDocument) {
    setPrintingId(doc.id)
    const res = await getOrgDocumentSignedUrl(orgSlug, doc.id)
    setPrintingId(null)
    if (!res.ok) { toast.error(res.error); return }
    const frame = printFrameRef.current
    if (!frame) return
    frame.onload = () => {
      try { frame.contentWindow?.print() } catch { toast.error('Não foi possível imprimir automaticamente — abra o documento e imprima por lá.') }
    }
    frame.src = res.url
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const res = await deleteOrgDocument(orgSlug, deleteTarget.id)
    if (!res.ok) { toast.error(res.error); setDeleteTarget(null); return }
    setDocs(prev => prev.filter(d => d.id !== deleteTarget.id))
    toast.success('Documento excluído.')
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-4">
      {/* Upload — rótulo + arquivo PDF */}
      <div className="rounded-lg border bg-muted/20 p-3 flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-[36%] min-w-[160px] space-y-1.5">
          <Label className="text-xs">Rótulo</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Ex.: Termo de responsabilidade" />
        </div>
        <div className="flex flex-1 flex-wrap items-end justify-center gap-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Arquivo (PDF)</Label>
            <input ref={fileRef} type="file" accept="application/pdf"
              className="block text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border file:bg-background file:text-xs file:font-medium file:cursor-pointer" />
          </div>
          <Button type="button" onClick={handleUpload} disabled={uploading}>
            {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Upload className="w-4 h-4 mr-1.5" />}
            Adicionar
          </Button>
        </div>
      </div>

      {/* Lista */}
      {docs.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          Nenhum documento adicionado ainda.
        </div>
      ) : (
        <div className="rounded-lg border divide-y">
          {docs.map(doc => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="w-4 h-4 text-rose-500 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{doc.label}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {doc.file_name}{doc.file_size_bytes ? ` · ${fmtSize(doc.file_size_bytes)}` : ''} · {fmtDate(doc.created_at)}
                </div>
              </div>
              <Button type="button" size="sm" variant="outline" disabled={openingId === doc.id} onClick={() => handleOpen(doc)}>
                {openingId === doc.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5 mr-1.5" />}
                Abrir
              </Button>
              <Button type="button" size="sm" variant="outline" disabled={printingId === doc.id} onClick={() => handlePrint(doc)}>
                {printingId === doc.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Printer className="w-3.5 h-3.5 mr-1.5" />}
                Imprimir
              </Button>
              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 shrink-0" onClick={() => setDeleteTarget(doc)} aria-label="Excluir">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Popup de abertura — PDF + botão de imprimir */}
      <Dialog open={!!openDoc} onOpenChange={o => !o && setOpenDoc(null)}>
        <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden flex flex-col">
          <DialogHeader className="p-4 pb-2 flex-row items-center justify-between space-y-0">
            <DialogTitle className="truncate">{openDoc?.doc.label}</DialogTitle>
            {openDoc && (
              <Button type="button" size="sm" variant="outline" className="mr-8" onClick={() => handlePrint(openDoc.doc)}>
                <Printer className="w-3.5 h-3.5 mr-1.5" /> Imprimir
              </Button>
            )}
          </DialogHeader>
          <div className="flex-1 px-4 pb-4 min-h-0">
            {openDoc && (
              <iframe title={openDoc.doc.label} src={openDoc.url} className="w-full h-full rounded-lg border" />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* iframe oculto — usado só pra "Imprimir" direto na linha, sem abrir o popup */}
      <iframe ref={printFrameRef} className="hidden" title="Impressão" />

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir documento</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.label} — essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
