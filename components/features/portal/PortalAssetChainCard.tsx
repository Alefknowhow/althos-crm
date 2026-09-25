'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Plus, CheckCircle2, XCircle, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Video } from 'lucide-react'
import { cn } from '@/lib/utils'
import { addPortalAssetComment, respondPortalAsset, type PortalLibraryAssetChain } from '@/actions/client-portal-library'
import MediaPreview from '@/components/features/library/MediaPreview'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando sua aprovação', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-success text-success-foreground' },
  alteracao_solicitada: { label: 'Alteração solicitada', cls: 'bg-destructive text-destructive-foreground' },
}
const KIND_LABEL: Record<string, string> = { bruto: 'Material bruto', produzido: 'Criativo produzido' }

function AssetIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.startsWith('video/')) return <Video className="w-4 h-4 shrink-0 text-muted-foreground" />
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
  return <ImageIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
}

export default function PortalAssetChainCard({
  contatoId, chain, onReload, onNewVersion, canUploadVersion,
}: {
  contatoId: string
  chain: PortalLibraryAssetChain
  onReload: () => void
  onNewVersion: () => void
  canUploadVersion: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [rejectMode, setRejectMode] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [responding, setResponding] = useState(false)
  const status = STATUS_LABEL[chain.latest.status] || STATUS_LABEL.pendente
  const canRespond = chain.latest.kind === 'produzido' && chain.latest.status === 'pendente'

  async function handleComment() {
    if (!commentBody.trim()) return
    setSavingComment(true)
    const res = await addPortalAssetComment(contatoId, chain.latest.id, commentBody)
    setSavingComment(false)
    if (!res.ok) { toast.error(res.error); return }
    setCommentBody('')
    onReload()
  }

  async function handleApprove() {
    setResponding(true)
    const res = await respondPortalAsset(contatoId, chain.latest.id, 'aprovado', null)
    setResponding(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Material aprovado.')
    onReload()
  }

  async function handleRequestChange() {
    if (!rejectMode) { setRejectMode(true); return }
    if (!rejectComment.trim()) { toast.error('Descreva o que precisa mudar.'); return }
    setResponding(true)
    const res = await respondPortalAsset(contatoId, chain.latest.id, 'alteracao_solicitada', rejectComment)
    setResponding(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Solicitação enviada.')
    setRejectMode(false); setRejectComment('')
    onReload()
  }

  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-start gap-2.5">
        <AssetIcon mimeType={chain.latest.mimeType} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{chain.latest.title}</p>
          <p className="text-xs text-muted-foreground">
            {KIND_LABEL[chain.latest.kind]} · v{chain.latest.version}
            {chain.versions.length > 1 && ` · ${chain.versions.length} versões`}
          </p>
        </div>
        <Badge className={cn('shrink-0 text-[10px]', status.cls)}>{status.label}</Badge>
      </div>

      {chain.latest.signedUrl && (
        <MediaPreview
          src={chain.latest.signedUrl}
          mimeType={chain.latest.mimeType}
          width={chain.latest.width}
          height={chain.latest.height}
          title={chain.latest.title}
        />
      )}

      {chain.latest.description && <p className="text-xs text-muted-foreground">{chain.latest.description}</p>}

      {canRespond && (
        <div className="space-y-2 border-t pt-2">
          {rejectMode && (
            <Textarea value={rejectComment} onChange={e => setRejectComment(e.target.value)} placeholder="O que precisa mudar?" rows={2} autoFocus />
          )}
          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={handleApprove} disabled={responding}>
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> Aprovar
            </Button>
            <Button type="button" size="sm" variant="outline" className="flex-1 text-destructive hover:text-destructive" onClick={handleRequestChange} disabled={responding || (rejectMode && !rejectComment.trim())}>
              <XCircle className="w-3.5 h-3.5 mr-1.5" /> {rejectMode ? 'Enviar solicitação' : 'Solicitar alteração'}
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {canUploadVersion && (
          <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onNewVersion}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova versão
          </Button>
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          Comentários ({chain.comments.length})
        </Button>
      </div>

      {expanded && (
        <div className="space-y-2 border-t pt-2">
          {chain.comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
          {chain.comments.map(c => (
            <div key={c.id} className="text-xs">
              <span className="font-medium">{c.authorType === 'client' ? 'Você' : (c.authorName || 'Equipe')}</span>
              <span className="text-muted-foreground"> · {new Date(c.createdAt).toLocaleString('pt-BR')}</span>
              <p>{c.body}</p>
            </div>
          ))}
          <div className="flex gap-1.5">
            <Input value={commentBody} onChange={e => setCommentBody(e.target.value)} placeholder="Comentar..." className="h-8 text-xs" />
            <Button type="button" size="sm" className="h-8 text-xs" onClick={handleComment} disabled={savingComment}>Enviar</Button>
          </div>
        </div>
      )}
    </div>
  )
}
