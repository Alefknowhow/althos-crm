'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Loader2, Plus, Link2, Mail, Trash2, FileText, Image as ImageIcon, Video, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  addAssetComment, generateAssetLink, sendAssetLinkByEmail, deleteLatestAssetVersion,
  type LibraryAssetChain,
} from '@/actions/library-assets'
import MediaPreview from '@/components/features/library/MediaPreview'
import AssetVersionHistory, { VersionHistoryToggle } from '@/components/features/library/AssetVersionHistory'

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente: { label: 'Aguardando aprovação', cls: 'bg-amber-100 text-amber-700' },
  aprovado: { label: 'Aprovado', cls: 'bg-success text-success-foreground' },
  alteracao_solicitada: { label: 'Alteração solicitada', cls: 'bg-destructive text-destructive-foreground' },
}

const KIND_LABEL: Record<string, string> = { bruto: 'Material bruto', produzido: 'Criativo produzido' }

function AssetIcon({ mimeType }: { mimeType: string | null }) {
  if (mimeType?.startsWith('video/')) return <Video className="w-4 h-4 shrink-0 text-muted-foreground" />
  if (mimeType === 'application/pdf') return <FileText className="w-4 h-4 shrink-0 text-muted-foreground" />
  return <ImageIcon className="w-4 h-4 shrink-0 text-muted-foreground" />
}

export default function AssetChainCard({
  orgSlug, chain, onReload, onNewVersion, campaignName,
}: { orgSlug: string; chain: LibraryAssetChain; onReload: () => void; onNewVersion: () => void; campaignName?: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const status = STATUS_LABEL[chain.latest.status] || STATUS_LABEL.pendente
  // No card resumido só marca "Final aprovada" quando a própria versão
  // exibida (a mais recente) é a aprovada — quando existe uma versão mais
  // nova ainda pendente por cima de uma aprovada, o selo aparece dentro do
  // histórico de versões (AssetVersionHistory), não aqui no topo.
  const isFinalApproved = chain.latest.status === 'aprovado'

  async function handleComment() {
    if (!commentBody.trim()) return
    setSavingComment(true)
    const res = await addAssetComment(orgSlug, chain.latest.id, commentBody)
    setSavingComment(false)
    if (!res.ok) { toast.error(res.error); return }
    setCommentBody('')
    onReload()
  }

  async function handleLink() {
    setGeneratingLink(true)
    const res = await generateAssetLink(orgSlug, chain.latest.id)
    setGeneratingLink(false)
    if (!res.ok) { toast.error(res.error); return }
    const url = `${window.location.origin}/biblioteca/${res.token}`
    await navigator.clipboard.writeText(url)
    toast.success('Link de aprovação copiado.')
  }

  async function handleSendEmail() {
    if (!email.trim()) { toast.error('Informe o e-mail.'); return }
    setSendingEmail(true)
    const res = await sendAssetLinkByEmail(orgSlug, chain.latest.id, email.trim())
    setSendingEmail(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Link enviado por e-mail.')
    setEmailOpen(false)
    setEmail('')
  }

  async function handleDeleteLatest() {
    if (chain.versions.length > 1) {
      if (!confirm(`Remover a versão ${chain.latest.version}? A versão anterior continua disponível.`)) return
    } else if (!confirm('Remover este material?')) return
    const res = await deleteLatestAssetVersion(orgSlug, chain.latest.id)
    if (!res.ok) { toast.error(res.error); return }
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
            {campaignName && ` · ${campaignName}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Badge className={cn('text-[10px]', status.cls)}>{status.label}</Badge>
          {isFinalApproved && <Badge className="text-[10px] bg-primary text-primary-foreground">Final aprovada</Badge>}
        </div>
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

      <div className="flex flex-wrap items-center gap-1.5">
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={onNewVersion}>
          <Plus className="w-3.5 h-3.5 mr-1" /> Nova versão
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleLink} disabled={generatingLink}>
          {generatingLink ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Link2 className="w-3.5 h-3.5 mr-1" />} Link de aprovação
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEmailOpen(true)}>
          <Mail className="w-3.5 h-3.5 mr-1" /> Enviar por e-mail
        </Button>
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={handleDeleteLatest}>
          <Trash2 className="w-3.5 h-3.5 mr-1" /> Remover
        </Button>
        {chain.versions.length > 1 && (
          <VersionHistoryToggle count={chain.versions.length} open={historyOpen} onToggle={() => setHistoryOpen(!historyOpen)} />
        )}
        <Button type="button" size="sm" variant="ghost" className="h-7 text-xs ml-auto" onClick={() => setExpanded(!expanded)}>
          {expanded ? <ChevronUp className="w-3.5 h-3.5 mr-1" /> : <ChevronDown className="w-3.5 h-3.5 mr-1" />}
          Comentários ({chain.comments.length})
        </Button>
      </div>

      {historyOpen && (
        <div className="border-t pt-2">
          <AssetVersionHistory versions={chain.versions} />
        </div>
      )}

      {expanded && (
        <div className="space-y-2 border-t pt-2">
          {chain.comments.length === 0 && <p className="text-xs text-muted-foreground">Nenhum comentário ainda.</p>}
          {chain.comments.map(c => (
            <div key={c.id} className="text-xs">
              <span className="font-medium">{c.authorType === 'client' ? (c.authorName || 'Cliente') : (c.authorName || 'Equipe')}</span>
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

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Enviar por e-mail</DialogTitle></DialogHeader>
          <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="cliente@email.com" />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEmailOpen(false)} disabled={sendingEmail}>Cancelar</Button>
            <Button type="button" onClick={handleSendEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : null} Enviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
