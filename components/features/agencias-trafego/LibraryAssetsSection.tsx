'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Link2, Mail, Trash2, FileText, Image as ImageIcon, Video, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  uploadLibraryAsset, addAssetComment, generateAssetLink, sendAssetLinkByEmail, deleteLatestAssetVersion,
  type LibraryAssetChain,
} from '@/actions/library-assets'

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

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function LibraryAssetsSection({
  orgSlug, contatoId, chains,
}: { orgSlug: string; contatoId: string; chains: LibraryAssetChain[] }) {
  const router = useRouter()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [versionTarget, setVersionTarget] = useState<{ rootAssetId: string; latestId: string } | null>(null)

  function reload() { router.refresh() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Biblioteca</h3>
          <p className="text-xs text-muted-foreground">Materiais brutos e criativos produzidos — versionados, com comentários e aprovação do cliente.</p>
        </div>
        <Button type="button" size="sm" onClick={() => { setVersionTarget(null); setUploadOpen(true) }}>
          <Plus className="w-4 h-4 mr-1.5" /> Enviar material
        </Button>
      </div>

      {chains.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">Nenhum material enviado ainda.</p>
        </div>
      ) : (
        <>
          {(['bruto', 'produzido'] as const).map(kind => {
            const group = chains.filter(c => c.latest.kind === kind)
            if (group.length === 0) return null
            return (
              <div key={kind} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{KIND_LABEL[kind]}s</p>
                <div className="space-y-3">
                  {group.map(chain => (
                    <AssetChainCard
                      key={chain.rootAssetId}
                      orgSlug={orgSlug}
                      chain={chain}
                      onReload={reload}
                      onNewVersion={() => { setVersionTarget({ rootAssetId: chain.rootAssetId, latestId: chain.latest.id }); setUploadOpen(true) }}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </>
      )}

      <UploadAssetDialog
        orgSlug={orgSlug}
        contatoId={contatoId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        parentAssetId={versionTarget?.latestId || null}
        onDone={reload}
      />
    </div>
  )
}

function AssetChainCard({
  orgSlug, chain, onReload, onNewVersion,
}: { orgSlug: string; chain: LibraryAssetChain; onReload: () => void; onNewVersion: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const [commentBody, setCommentBody] = useState('')
  const [savingComment, setSavingComment] = useState(false)
  const [generatingLink, setGeneratingLink] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const status = STATUS_LABEL[chain.latest.status] || STATUS_LABEL.pendente

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
          </p>
        </div>
        <Badge className={cn('shrink-0 text-[10px]', status.cls)}>{status.label}</Badge>
      </div>

      {chain.latest.signedUrl && (
        <div className="rounded-md border overflow-hidden bg-muted/20 max-h-56">
          {chain.latest.mimeType?.startsWith('video/') ? (
            <video src={chain.latest.signedUrl} controls className="w-full max-h-56" />
          ) : chain.latest.mimeType === 'application/pdf' ? (
            <a href={chain.latest.signedUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 text-xs text-primary hover:underline">
              <FileText className="w-4 h-4" /> Abrir PDF
            </a>
          ) : (
            <img src={chain.latest.signedUrl} alt={chain.latest.title} className="w-full max-h-56 object-contain" />
          )}
        </div>
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

function UploadAssetDialog({
  orgSlug, contatoId, open, onOpenChange, parentAssetId, onDone,
}: {
  orgSlug: string
  contatoId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  parentAssetId: string | null
  onDone: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [kind, setKind] = useState<'bruto' | 'produzido'>('bruto')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Selecione um arquivo.'); return }
    if (!title.trim()) { toast.error('Informe um título.'); return }

    setSaving(true)
    try {
      const base64 = await fileToBase64(file)
      const res = await uploadLibraryAsset(orgSlug, {
        contatoId, kind, title, description: description || null,
        parentAssetId, filename: file.name, contentType: file.type, base64,
      })
      if (!res.ok) { toast.error(res.error); return }
      toast.success(parentAssetId ? 'Nova versão enviada.' : 'Material enviado.')
      setTitle(''); setDescription('')
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
          {!parentAssetId && (
            <div className="space-y-2">
              <label className="text-xs font-medium">Tipo</label>
              <Select value={kind} onValueChange={v => setKind(v as 'bruto' | 'produzido')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bruto">Material bruto (enviado pelo cliente)</SelectItem>
                  <SelectItem value="produzido">Criativo produzido (feito pela agência)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-medium">Título</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Reel Black Friday v1" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Descrição (opcional)</label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium">Arquivo</label>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,video/webm,application/pdf" className="text-xs" />
          </div>
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
