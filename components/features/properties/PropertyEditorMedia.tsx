'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Trash2, Upload, ImageIcon, FileText, Star } from 'lucide-react'
import type { PropertyMediaRow } from '@/actions/properties'

/** Label + field wrapper — same as PropertyEditor's local `F`. */
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  )
}

/**
 * "Fotos e documentos" card of PropertyEditor. Split out of
 * PropertyEditor.tsx — purely presentational, upload/remove/cover
 * handlers passed in as props.
 */
export function PropertyEditorMedia({
  photos, documents, uploading,
  photoInputRef, docInputRef,
  onUpload, onRemoveMedia, onSetCover,
}: {
  photos: PropertyMediaRow[]
  documents: PropertyMediaRow[]
  uploading: boolean
  photoInputRef: React.RefObject<HTMLInputElement>
  docInputRef: React.RefObject<HTMLInputElement>
  onUpload: (files: FileList | null, mediaType: 'photo' | 'document') => void
  onRemoveMedia: (id: string) => void
  onSetCover: (id: string) => void
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Fotos e documentos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <F label="Fotos">
          <input ref={photoInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => onUpload(e.target.files, 'photo')} />
          <div className="flex flex-wrap gap-2">
            {photos.map(m => (
              <div key={m.id} className="relative group w-24 h-20 rounded-md overflow-hidden border bg-muted">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.storage_key} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                  <button type="button" title="Definir como capa" className="text-white/90 hover:text-amber-300" onClick={() => onSetCover(m.id)}><Star className="w-4 h-4" /></button>
                  <button type="button" title="Remover" className="text-white/90 hover:text-red-300" onClick={() => onRemoveMedia(m.id)}><Trash2 className="w-4 h-4" /></button>
                </div>
                {m.is_cover && <span className="absolute top-1 left-1 text-[9px] font-bold uppercase bg-black/60 text-white px-1.5 py-0.5 rounded">capa</span>}
              </div>
            ))}
            <button type="button" onClick={() => photoInputRef.current?.click()} disabled={uploading}
              className="w-24 h-20 rounded-md border-2 border-dashed flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/40 text-xs gap-1">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
              Adicionar
            </button>
          </div>
        </F>
        <F label="Documentos">
          <input ref={docInputRef} type="file" accept=".pdf,image/*" multiple className="hidden" onChange={e => onUpload(e.target.files, 'document')} />
          <div className="space-y-1.5">
            {documents.map(m => (
              <div key={m.id} className="flex items-center gap-2 border rounded-md px-2.5 py-1.5 text-sm">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <a href={m.storage_key} target="_blank" rel="noopener noreferrer" className="flex-1 truncate hover:underline">{m.label || 'Documento'}</a>
                <button type="button" onClick={() => onRemoveMedia(m.id)} className="text-destructive shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => docInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1.5" />} Adicionar documento
            </Button>
          </div>
        </F>
      </CardContent>
    </Card>
  )
}
