'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, Copy, Trash2, MousePointerClick } from 'lucide-react'
import { createTrackingLink, deleteTrackingLink, type TrackingLink } from '@/actions/tracking-links'
import type { LinkPerformance } from '@/actions/trafego-tracking'
import { formatCurrency } from '@/lib/utils'

export default function TrackingLinksManager({
  orgSlug, clientId, initial, performance,
}: {
  orgSlug: string
  clientId: string
  initial: TrackingLink[]
  performance: LinkPerformance[]
}) {
  const perfByLink = new Map(performance.map(p => [p.linkId, p]))
  const router = useRouter()
  const [links, setLinks] = useState(initial)
  const [destinationUrl, setDestinationUrl] = useState('')
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  async function handleCreate() {
    if (!destinationUrl.trim()) { toast.error('Informe a URL de destino'); return }
    setSaving(true)
    const res = await createTrackingLink(orgSlug, clientId, { destinationUrl: destinationUrl.trim(), label: label.trim() || null })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    setLinks(prev => [res.link, ...prev])
    setDestinationUrl('')
    setLabel('')
    toast.success('Link de rastreamento criado')
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir este link? O histórico de cliques associado a ele deixa de contar no funil.')) return
    setLinks(prev => prev.filter(l => l.id !== id))
    const res = await deleteTrackingLink(orgSlug, id, clientId)
    if (!res.ok) { toast.error(res.error); router.refresh(); return }
    router.refresh()
  }

  function copyLink(code: string) {
    navigator.clipboard.writeText(`${origin}/r/${code}`)
    toast.success('Link copiado')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2"><MousePointerClick className="w-4 h-4" /> Links de rastreamento</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Coloque este link no anúncio/story/bio em vez do link direto — ele registra o clique antes de redirecionar pro destino.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-2 p-3 border rounded-md bg-secondary/30">
          <div className="flex-1 min-w-[220px] space-y-1">
            <Label className="text-xs">URL de destino</Label>
            <Input value={destinationUrl} onChange={e => setDestinationUrl(e.target.value)} placeholder="https://…/formulario-do-cliente" />
          </div>
          <div className="w-48 space-y-1">
            <Label className="text-xs">Rótulo (opcional)</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Story 24/08 — Oferta X" />
          </div>
          <Button size="sm" onClick={handleCreate} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Plus className="w-3.5 h-3.5 mr-1.5" />}
            Criar link
          </Button>
        </div>

        {links.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum link criado ainda.</p>
        ) : (
          <div className="space-y-2">
            {links.map(l => {
              const p = perfByLink.get(l.id)
              return (
                <div key={l.id} className="border rounded-md p-2.5 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{l.label || `/r/${l.code}`}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        /r/{l.code} → {l.destination_url}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground tabular-nums">{l.clicks_count} clique{l.clicks_count !== 1 ? 's' : ''}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyLink(l.code)} title="Copiar link">
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(l.id)} title="Excluir">
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {p && p.clicks > 0 && (
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                      <span><span className="font-medium text-foreground">{p.leads}</span> lead{p.leads !== 1 ? 's' : ''} (último clique antes da conversão)</span>
                      <span><span className="font-medium text-foreground">{p.sales}</span> venda{p.sales !== 1 ? 's' : ''}</span>
                      {p.revenueCents > 0 && <span className="font-medium text-foreground">{formatCurrency(p.revenueCents)}</span>}
                      {p.clickToLeadPct != null && <span>{p.clickToLeadPct.toFixed(1)}% conversão</span>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
