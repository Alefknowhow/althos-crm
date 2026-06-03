'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import { cn, formatCurrency } from '@/lib/utils'
import {
  createPackage, deletePackage, generateProposalFromPackage, type ShowcaseRow,
} from '@/actions/travel-showcase'
import { categoryLabel, sortCategories } from '@/lib/showcase'
import { toast } from 'sonner'
import {
  Store, Plus, MapPin, CalendarRange, Trash2, Pencil, EyeOff,
  Share2, Copy, ExternalLink, CheckCircle2, FileSignature, Loader2, Video,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function destOf(p: ShowcaseRow) {
  return (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
}

export default function ShowcaseList({
  orgSlug,
  packages,
  vitrineToken,
}: {
  orgSlug: string
  packages: ShowcaseRow[]
  vitrineToken: string | null
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [genId, setGenId] = useState<string | null>(null)
  const [vitrineUrl, setVitrineUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (vitrineToken) setVitrineUrl(`${window.location.origin}/v/${vitrineToken}`)
  }, [vitrineToken])

  // agrupa por categoria, na ordem canônica
  const grouped = useMemo(() => {
    const map = new Map<string, ShowcaseRow[]>()
    for (const p of packages) {
      const key = p.category || '__none'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return sortCategories(packages.map(p => p.category)).map(key => ({
      key,
      label: key === '__none' ? 'Sem categoria' : categoryLabel(key),
      items: map.get(key) || [],
    }))
  }, [packages])

  async function handleCreate() {
    setCreating(true)
    const res = await createPackage(orgSlug, {})
    setCreating(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao criar pacote'); return }
    router.push(`/app/${orgSlug}/vitrine/${res.data.id}`)
  }

  async function handleDelete(id: string) {
    const res = await deletePackage(orgSlug, id)
    if (res.ok) { toast.success('Pacote excluído'); router.refresh() }
    else toast.error(res.error)
  }

  async function handleGenerate(id: string) {
    setGenId(id)
    const res = await generateProposalFromPackage(orgSlug, id)
    setGenId(null)
    if (!res.ok) { toast.error(res.error || 'Erro ao gerar proposta'); return }
    toast.success('Proposta gerada — complete com o cliente')
    router.push(`/app/${orgSlug}/proposta/${res.data.id}`)
  }

  return (
    <>
      {/* Link público da vitrine */}
      {vitrineToken && (
        <div className="rounded-xl border border-primary/20 bg-primary/[0.03] p-4 flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0">
            <Share2 className="w-4 h-4 text-primary" /> Link público da vitrine
          </div>
          <Input readOnly value={vitrineUrl} onFocus={e => e.currentTarget.select()} className="font-mono text-xs" />
          <div className="flex gap-2 shrink-0">
            <Button type="button" variant="outline" size="sm"
              onClick={async () => {
                try { await navigator.clipboard.writeText(vitrineUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
                catch { toast.error('Não foi possível copiar') }
              }}>
              {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
              {copied ? 'Copiado' : 'Copiar'}
            </Button>
            <Button type="button" variant="outline" size="sm" asChild>
              <a href={vitrineUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir vitrine
              </a>
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-4">
        <p className="text-sm text-muted-foreground">{packages.length} pacote(s) na vitrine</p>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Adicionar novo pacote'}
        </Button>
      </div>

      {packages.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Vitrine vazia"
          description="Crie pacotes prontos de viagem para exibir publicamente. Cada pacote pode virar uma proposta com um clique."
        >
          <Button size="lg" className="mt-4" onClick={handleCreate} disabled={creating}>
            <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Adicionar novo pacote'}
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-8">
          {grouped.map(group => (
            <section key={group.key}>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
                <span className="text-xs text-muted-foreground">({group.items.length})</span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map(p => {
                  const cover = (p.cover_photos || [])[0]
                  const dest = destOf(p)
                  return (
                    <div key={p.id} className="rounded-xl border bg-card overflow-hidden flex flex-col">
                      <div className="relative h-36 bg-muted">
                        {cover ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={cover} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            {p.youtube_url ? <Video className="w-8 h-8 opacity-40" /> : <Store className="w-8 h-8 opacity-40" />}
                          </div>
                        )}
                        {!p.is_published && (
                          <Badge variant="outline" className="absolute top-2 left-2 bg-background/90 gap-1 text-[10px]">
                            <EyeOff className="w-3 h-3" /> Oculto
                          </Badge>
                        )}
                      </div>
                      <div className="p-3 flex flex-col flex-1">
                        <p className="font-medium text-sm leading-tight line-clamp-2">{p.title || 'Pacote sem título'}</p>
                        {dest && (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{dest}</span>
                          </div>
                        )}
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <CalendarRange className="w-3 h-3 shrink-0" />
                          <span className="truncate">{fmtDate(p.start_date)} – {fmtDate(p.end_date)}</span>
                        </div>
                        <div className="mt-2 text-sm font-semibold tabular-nums">{formatCurrency(p.total_cents || 0)}</div>

                        <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-1.5">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/app/${orgSlug}/vitrine/${p.id}`}><Pencil className="w-3.5 h-3.5 mr-1" /> Editar</Link>
                          </Button>
                          <Button size="sm" variant="outline" disabled={genId === p.id} onClick={() => handleGenerate(p.id)}>
                            {genId === p.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <FileSignature className="w-3.5 h-3.5 mr-1" />}
                            Gerar proposta
                          </Button>
                          <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 ml-auto"
                            onClick={() => setDeleteId(p.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pacote</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita. O pacote sairá da vitrine pública.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
