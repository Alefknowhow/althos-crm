'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ImagePlus, Loader2, Link as LinkIcon, Trash2 } from 'lucide-react'
import { uploadCreative, generateCreativeLink, deleteCreative, type Creative } from '@/actions/campaign-creatives'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pendente: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  aprovado: { label: 'Aprovado', className: 'bg-green-100 text-green-800 border-green-200' },
  reprovado: { label: 'Reprovado', className: 'bg-red-100 text-red-800 border-red-200' },
}

export default function CampaignCreativesSection({
  orgSlug, contatoId, creatives,
}: { orgSlug: string; contatoId: string; creatives: Creative[] }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [uploading, setUploading] = useState(false)
  const [linkingId, setLinkingId] = useState<string | null>(null)

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) { toast.error('Selecione um arquivo'); return }
    if (!title.trim()) { toast.error('Informe um título'); return }

    setUploading(true)
    const formData = new FormData()
    formData.set('file', file)
    formData.set('contatoId', contatoId)
    formData.set('title', title)
    const res = await uploadCreative(orgSlug, formData)
    setUploading(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Criativo enviado')
    setTitle('')
    if (fileRef.current) fileRef.current.value = ''
    router.refresh()
  }

  async function handleCopyLink(id: string) {
    setLinkingId(id)
    const res = await generateCreativeLink(orgSlug, id)
    setLinkingId(null)
    if (!res.ok) { toast.error(res.error); return }
    const url = `${window.location.origin}/criativo/${res.token}`
    await navigator.clipboard.writeText(url)
    toast.success('Link de aprovação copiado')
  }

  async function handleDelete(id: string) {
    if (!confirm('Remover este criativo?')) return
    const res = await deleteCreative(orgSlug, id)
    if (!res.ok) { toast.error(res.error); return }
    router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><ImagePlus className="w-4 h-4" /> Criativos para aprovação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end gap-2 p-3 border rounded-md bg-secondary/30">
          <div className="flex-1 space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Título</label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Criativo carrossel — semana 1" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Arquivo</label>
            <input ref={fileRef} type="file" accept="image/*,video/mp4,video/quicktime,application/pdf" className="text-xs" />
          </div>
          <Button size="sm" onClick={handleUpload} disabled={uploading}>
            {uploading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />} Enviar
          </Button>
        </div>

        {creatives.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum criativo enviado ainda.</p>
        ) : (
          <div className="space-y-2">
            {creatives.map(c => {
              const status = STATUS_LABEL[c.status]
              return (
                <div key={c.id} className="flex items-center justify-between text-sm border rounded-md p-2.5">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{c.title}</div>
                    {c.client_comment && (
                      <div className="text-xs text-muted-foreground truncate">&quot;{c.client_comment}&quot;</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCopyLink(c.id)} disabled={linkingId === c.id}>
                      {linkingId === c.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LinkIcon className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
