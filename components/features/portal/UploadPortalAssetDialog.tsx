'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { uploadPortalLibraryAsset } from '@/actions/client-portal-library'
import { detectMediaDimensions, ORIENTATION_DIMENSIONS } from '@/lib/media-dimensions'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Upload de material bruto pelo Portal do Cliente — mesma lógica de
 *  detecção de dimensão do UploadLibraryAssetDialog (painel interno), sem
 *  seletor de tipo (o cliente só cria material bruto). */
export default function UploadPortalAssetDialog({
  contatoId, open, onOpenChange, parentAssetId, onDone,
}: {
  contatoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  parentAssetId: string | null
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null)
  const [needsOrientation, setNeedsOrientation] = useState(false)
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal' | 'quadrado'>('vertical')

  async function handleFileChange() {
    const file = fileRef.current?.files?.[0]
    setDims(null)
    setNeedsOrientation(false)
    if (!file || file.type === 'application/pdf') return
    const detected = await detectMediaDimensions(file)
    if (detected) setDims(detected)
    else setNeedsOrientation(true)
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Selecione um arquivo.'); return }
    if (!title.trim()) { toast.error('Informe um título.'); return }

    const resolvedDims = dims || (needsOrientation ? ORIENTATION_DIMENSIONS[orientation] : null)

    setSaving(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await uploadPortalLibraryAsset(contatoId, {
        title, description: description || null,
        parentAssetId, filename: file.name, contentType: file.type, base64,
        width: resolvedDims?.width, height: resolvedDims?.height,
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(parentAssetId ? 'Nova versão enviada.' : 'Material enviado.')
      setTitle(''); setDescription(''); setDims(null); setNeedsOrientation(false)
      if (fileRef.current) fileRef.current.value = ''
      onOpenChange(false)
      onDone()
    } catch {
      toast.error('Falha ao enviar arquivo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{parentAssetId ? 'Nova versão' : 'Enviar material'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium">Título</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Vídeos brutos da campanha" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Descrição (opcional)</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Arquivo</label>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" className="text-xs" onChange={handleFileChange} />
            {dims && <p className="text-xs text-muted-foreground">Dimensão detectada: {dims.width}×{dims.height}px</p>}
          </div>
          {needsOrientation && (
            <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/[0.03] p-2.5">
              <p className="text-xs text-muted-foreground">Não conseguimos detectar a dimensão do arquivo — selecione o enquadramento pra exibir corretamente:</p>
              <Select value={orientation} onValueChange={v => setOrientation(v as 'vertical' | 'horizontal' | 'quadrado')}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="vertical">Retrato / vertical (9:16)</SelectItem>
                  <SelectItem value="horizontal">Paisagem / horizontal (16:9)</SelectItem>
                  <SelectItem value="quadrado">Quadrado (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button type="button" onClick={handleUpload} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Enviando…</> : 'Enviar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
