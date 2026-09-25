'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, XCircle, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import { respondToLibraryAssetPublic, type PublicLibraryAsset } from '@/actions/library-assets-public'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando sua aprovação', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-success text-success-foreground' },
  alteracao_solicitada: { label: 'Alteração solicitada', cls: 'bg-destructive text-destructive-foreground' },
}

export default function PublicLibraryAssetView({ token, asset }: { token: string; asset: PublicLibraryAsset }) {
  const [status, setStatus] = useState(asset.status)
  const [comment, setComment] = useState('')
  const [mode, setMode] = useState<'idle' | 'reject'>('idle')
  const [sending, setSending] = useState(false)
  const statusInfo = STATUS_LABEL[status] || STATUS_LABEL.pendente
  const decided = status !== 'pendente'

  async function respond(next: 'aprovado' | 'alteracao_solicitada') {
    if (next === 'alteracao_solicitada' && mode !== 'reject') { setMode('reject'); return }
    if (next === 'alteracao_solicitada' && !comment.trim()) return

    setSending(true)
    const res = await respondToLibraryAssetPublic(token, next, comment || null)
    setSending(false)
    if (!res.ok) { alert(res.error); return }
    setStatus(next)
  }

  return (
    <div className="min-h-screen bg-muted/20 flex items-center justify-center p-4">
      <div className="w-full max-w-lg rounded-xl border bg-background p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">{asset.title}</h1>
            <p className="text-xs text-muted-foreground">Versão {asset.version}</p>
          </div>
          <Badge className={cn('text-[10px] shrink-0', statusInfo.cls)}>{statusInfo.label}</Badge>
        </div>

        {asset.description && <p className="text-sm text-muted-foreground">{asset.description}</p>}

        {asset.signedUrl && (
          <div className="rounded-lg border overflow-hidden bg-muted/20">
            {asset.mimeType?.startsWith('video/') ? (
              <video src={asset.signedUrl} controls className="w-full max-h-[420px]" />
            ) : asset.mimeType === 'application/pdf' ? (
              <a href={asset.signedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-4 text-sm text-primary hover:underline">
                <FileText className="w-4 h-4" /> Abrir PDF
              </a>
            ) : (
              <img src={asset.signedUrl} alt={asset.title} className="w-full max-h-[420px] object-contain" />
            )}
          </div>
        )}

        {asset.comments.length > 0 && (
          <div className="space-y-1.5 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Comentários</p>
            {asset.comments.map(c => (
              <div key={c.id} className="text-xs">
                <span className="font-medium">{c.authorType === 'client' ? 'Você' : (c.authorName || 'Equipe')}</span>
                <p>{c.body}</p>
              </div>
            ))}
          </div>
        )}

        {!decided && (
          <div className="space-y-2 border-t pt-3">
            {mode === 'reject' && (
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="O que precisa mudar?"
                rows={3}
                autoFocus
              />
            )}
            <div className="flex gap-2">
              <Button type="button" className="flex-1" onClick={() => respond('aprovado')} disabled={sending}>
                <CheckCircle2 className="w-4 h-4 mr-1.5" /> Aprovar
              </Button>
              <Button type="button" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={() => respond('alteracao_solicitada')} disabled={sending || (mode === 'reject' && !comment.trim())}>
                <XCircle className="w-4 h-4 mr-1.5" /> {mode === 'reject' ? 'Enviar solicitação' : 'Solicitar alteração'}
              </Button>
            </div>
          </div>
        )}

        {decided && (
          <p className="text-xs text-muted-foreground border-t pt-3">
            {status === 'aprovado' ? 'Você já aprovou este material.' : 'Você já solicitou alteração neste material.'}
          </p>
        )}
      </div>
    </div>
  )
}
