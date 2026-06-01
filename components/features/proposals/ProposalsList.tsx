'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import { cn, formatCurrency } from '@/lib/utils'
import { createProposal, deleteProposal, type ProposalRow } from '@/actions/travel-proposals'
import { toast } from 'sonner'
import {
  FileSignature, Plus, MapPin, Users, CalendarRange, Trash2, Pencil,
  ArrowLeft, Share2, Copy, ExternalLink, CheckCircle2, Clock, Wallet,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  sent: { label: 'Enviada', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  accepted: { label: 'Aceita', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Recusada', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}
function fmtTimestamp(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
}
function destOf(p: ProposalRow) {
  return (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
}

export default function ProposalsList({
  orgSlug,
  proposals,
}: {
  orgSlug: string
  proposals: ProposalRow[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.id ?? null)

  const selected = proposals.find(p => p.id === selectedId) ?? null

  async function handleCreate() {
    setCreating(true)
    const res = await createProposal(orgSlug, {})
    setCreating(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao criar proposta'); return }
    router.push(`/app/${orgSlug}/proposta/${res.data.id}`)
  }

  async function handleDelete(id: string) {
    const res = await deleteProposal(orgSlug, id)
    if (res.ok) {
      toast.success('Proposta excluída')
      if (selectedId === id) setSelectedId(null)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  if (proposals.length === 0) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Nenhuma proposta ainda"
        description="Crie sua primeira proposta de viagem com voos, hospedagem, serviços e condições de pagamento."
      >
        <Button size="lg" className="mt-4" onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Nova proposta'}
        </Button>
      </EmptyState>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{proposals.length} proposta(s)</p>
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Nova proposta'}
        </Button>
      </div>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-15rem)] min-h-[460px]">
        {/* ── List ─────────────────────────────────────────────── */}
        <div className={cn(
          'rounded-xl border bg-card overflow-y-auto divide-y',
          selected && 'hidden md:block',
        )}>
          {proposals.map(p => {
            const st = STATUS[p.status] || STATUS.draft
            const dest = destOf(p)
            const active = p.id === selectedId
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  'w-full text-left p-3 transition-colors',
                  active ? 'bg-primary/5' : 'hover:bg-muted/50',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium text-sm leading-tight line-clamp-2">
                    {p.title || 'Proposta sem título'}
                  </span>
                  <Badge variant="outline" className={cn('shrink-0 text-[10px] px-1.5 py-0', st.cls)}>{st.label}</Badge>
                </div>
                <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  {p.client_name && <div className="flex items-center gap-1.5"><Users className="w-3 h-3 shrink-0" /> <span className="truncate">{p.client_name}</span></div>}
                  {dest && <div className="flex items-center gap-1.5"><MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{dest}</span></div>}
                </div>
                <div className="mt-1.5 flex items-center justify-between">
                  <span className="text-sm font-bold tabular-nums">{formatCurrency(p.total_cents || 0)}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtTimestamp(p.created_at)}</span>
                </div>
              </button>
            )
          })}
        </div>

        {/* ── Detail ───────────────────────────────────────────── */}
        <div className={cn(
          'rounded-xl border bg-card overflow-y-auto',
          !selected && 'hidden md:flex',
        )}>
          {selected
            ? <ProposalDetail
                key={selected.id}
                orgSlug={orgSlug}
                p={selected}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
              />
            : (
              <div className="m-auto text-center text-sm text-muted-foreground p-8">
                <FileSignature className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Selecione uma proposta para ver os detalhes.
              </div>
            )}
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir proposta</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
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

function DetailRow({ icon: Icon, label, value }: { icon: any; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium break-words">{value}</p>
      </div>
    </div>
  )
}

function ProposalDetail({
  orgSlug, p, onBack, onDelete,
}: {
  orgSlug: string
  p: ProposalRow
  onBack: () => void
  onDelete: () => void
}) {
  const st = STATUS[p.status] || STATUS.draft
  const dest = destOf(p)
  const [publicUrl, setPublicUrl] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (p.public_token) setPublicUrl(`${window.location.origin}/p/${p.public_token}`)
  }, [p.public_token])

  const travelers = Array.isArray(p.travelers) ? p.travelers : []

  return (
    <div className="flex flex-col w-full">
      {/* header */}
      <div className="sticky top-0 bg-card/90 backdrop-blur border-b p-4 flex items-center gap-3 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{p.title || 'Proposta sem título'}</h2>
            <Badge variant="outline" className={cn('shrink-0', st.cls)}>{st.label}</Badge>
          </div>
        </div>
        <Button asChild size="sm">
          <Link href={`/app/${orgSlug}/proposta/${p.id}`}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Abrir editor</Link>
        </Button>
      </div>

      <div className="p-4 space-y-5">
        <div className="text-2xl font-bold tabular-nums">{formatCurrency(p.total_cents || 0)}</div>

        <div className="grid sm:grid-cols-2 gap-4">
          <DetailRow icon={Users} label="Cliente" value={p.client_name || '—'} />
          <DetailRow icon={MapPin} label="Destino" value={dest || '—'} />
          <DetailRow icon={CalendarRange} label="Período" value={`${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}`} />
          <DetailRow icon={Users} label="Nº de pessoas" value={p.pax_count ?? '—'} />
          <DetailRow icon={Wallet} label="Valor por pessoa" value={p.price_per_person_cents ? formatCurrency(p.price_per_person_cents) : '—'} />
          <DetailRow icon={Clock} label="Criada em" value={fmtTimestamp(p.created_at)} />
        </div>

        {travelers.length > 0 && (
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">Viajantes</p>
            <div className="flex flex-wrap gap-1.5">
              {travelers.map((t: any, i: number) => (
                <Badge key={i} variant="secondary">{t.name || 'Sem nome'}{t.age ? ` · ${t.age}` : ''}</Badge>
              ))}
            </div>
          </div>
        )}

        {p.public_token && (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
            <p className="text-sm font-medium flex items-center gap-2"><Share2 className="w-4 h-4 text-primary" /> Link público</p>
            <Input readOnly value={publicUrl} onFocus={e => e.currentTarget.select()} className="font-mono text-xs" />
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={async () => {
                try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
                catch { toast.error('Não foi possível copiar') }
              }}>
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 mr-1.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
              <Button type="button" variant="outline" size="sm" asChild>
                <a href={publicUrl} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Abrir / PDF</a>
              </Button>
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Excluir proposta
          </Button>
        </div>
      </div>
    </div>
  )
}
