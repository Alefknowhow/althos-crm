'use client'

import { useMemo, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import EmptyState from '@/components/ui/empty-state'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { DATE_BUCKETS, matchesDateBucket, type DateBucket } from '@/lib/utils/date-filter'
import { createProposal, deleteProposal, duplicateProposal, updateProposal, type ProposalRow } from '@/actions/travel-proposals'
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover'
import { toast } from 'sonner'
import {
  FileSignature, Plus, MapPin, Users, CalendarRange, Trash2, Pencil,
  ArrowLeft, Copy, ExternalLink, CheckCircle2, Clock, Wallet, Search, UserCircle2,
  CopyPlus, Loader2,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'

type Member = { user_id: string; name: string; email: string }
type Contato = { id: string; name: string }

const STATUS: Record<string, { label: string; short: string; cls: string }> = {
  draft: { label: 'Rascunho', short: 'R', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  sent: { label: 'Enviada', short: 'E', cls: 'bg-sky-100 text-sky-700 border-sky-200' },
  accepted: { label: 'Aceita', short: 'A', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Recusada', short: '✕', cls: 'bg-rose-100 text-rose-700 border-rose-200' },
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

/* Etiqueta de status de 1 letra, editável inline (sem abrir a cotação). */
function StatusTag({ orgSlug, proposalId, status: initial }: { orgSlug: string; proposalId: string; status: string }) {
  const router = useRouter()
  const [status, setStatus] = useState(initial)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const st = STATUS[status] || STATUS.draft

  async function change(next: string) {
    if (next === status) { setOpen(false); return }
    const prev = status
    setStatus(next); setSaving(true); setOpen(false)
    const res = await updateProposal(orgSlug, proposalId, { status: next })
    setSaving(false)
    if (!res.ok) { setStatus(prev); toast.error(res.error || 'Erro ao atualizar status') }
    else { toast.success('Status atualizado'); router.refresh() }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Status: ${st.label} — toque para alterar`}
          aria-label={`Status: ${st.label}. Toque para alterar`}
          className={cn(
            'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-transform hover:scale-105',
            st.cls,
          )}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : st.short}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        <p className="px-2 py-1 text-[11px] uppercase tracking-wide text-muted-foreground">Alterar status</p>
        {Object.entries(STATUS).map(([key, s]) => (
          <button
            key={key}
            type="button"
            onClick={() => change(key)}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted',
              key === status && 'bg-muted/60 font-medium',
            )}
          >
            <span className={cn('inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold leading-none', s.cls)}>{s.short}</span>
            {s.label}
            {key === status && <CheckCircle2 className="w-3.5 h-3.5 ml-auto text-emerald-600" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export default function ProposalsList({
  orgSlug,
  proposals,
  members = [],
  contatos = [],
}: {
  orgSlug: string
  proposals: ProposalRow[]
  members?: Member[]
  contatos?: Contato[]
}) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [duplicateFor, setDuplicateFor] = useState<ProposalRow | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(proposals[0]?.id ?? null)

  const [query, setQuery] = useState('')
  const [seller, setSeller] = useState<string>('all')
  const [dateBucket, setDateBucket] = useState<DateBucket>('all')

  const sellerName = useMemo(
    () => new Map(members.map(m => [m.user_id, m.name])),
    [members],
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return proposals.filter(p => {
      if (seller !== 'all' && p.created_by !== seller) return false
      if (!matchesDateBucket(p.created_at, dateBucket)) return false
      if (q) {
        const hay = [
          p.client_name, p.title, destOf(p),
          ...(Array.isArray(p.travelers) ? p.travelers.map((t: any) => t?.name) : []),
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [proposals, query, seller, dateBucket])

  const selected = proposals.find(p => p.id === selectedId) ?? null

  async function handleCreate() {
    setCreating(true)
    const res = await createProposal(orgSlug, {})
    setCreating(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao criar proposta'); return }
    router.push(`/app/${orgSlug}/cotacoes/${res.data.id}`)
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
      {/* Filters — busca em cima; controles compactos numa única linha abaixo */}
      <div className="flex flex-col gap-2 mb-4">
        {/* Texto (busca) numa linha própria, acima dos botões */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar por cliente, destino, título…"
            className="pl-8 h-9"
          />
        </div>

        {/* Controles compactos: filtro de data + vendedor + nova proposta */}
        <div className="flex items-center gap-1.5">
          <Select value={dateBucket} onValueChange={v => setDateBucket(v as DateBucket)}>
            <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:flex-none sm:w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_BUCKETS.map(b => (
                <SelectItem key={b.id} value={b.id} className="text-xs">{b.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {members.length > 0 && (
            <Select value={seller} onValueChange={setSeller}>
              <SelectTrigger className="h-8 text-xs flex-1 min-w-0 sm:flex-none sm:w-[170px]">
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">Todos os vendedores</SelectItem>
                {members.map(m => (
                  <SelectItem key={m.user_id} value={m.user_id} className="text-xs">{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Button
            onClick={handleCreate}
            disabled={creating}
            size="sm"
            className="h-8 px-2.5 text-xs shrink-0"
            title="Nova proposta"
            aria-label="Nova proposta"
          >
            <Plus className="w-3.5 h-3.5 sm:mr-1.5" />
            <span className="hidden sm:inline">{creating ? 'Criando…' : 'Nova proposta'}</span>
          </Button>
        </div>
      </div>

      <p className="text-sm text-muted-foreground mb-2">{filtered.length} de {proposals.length} proposta(s)</p>

      <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100dvh-19rem)] min-h-[440px]">
        {/* ── List ─────────────────────────────────────────────── */}
        <div className={cn(
          'rounded-xl border bg-card overflow-y-auto divide-y',
          selected && 'hidden md:block',
        )}>
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma proposta encontrada com esses filtros.
            </div>
          ) : filtered.map(p => {
            const st = STATUS[p.status] || STATUS.draft
            const dest = destOf(p)
            const active = p.id === selectedId
            const seller = p.created_by ? sellerName.get(p.created_by) : null
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
                    {p.client_name || p.title || 'Proposta sem título'}
                  </span>
                  <span
                    title={st.label}
                    className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold leading-none', st.cls)}
                  >
                    {st.short}
                  </span>
                </div>
                {dest && (
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{dest}</span>
                  </div>
                )}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs font-medium tabular-nums text-muted-foreground">{formatCurrency(p.total_cents || 0)}</span>
                  <span className="text-[11px] text-muted-foreground">{fmtTimestamp(p.created_at)}</span>
                </div>
                {seller && (
                  <div className="mt-1.5">
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal gap-1">
                      <UserCircle2 className="w-3 h-3" /> {seller}
                    </Badge>
                  </div>
                )}
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
                sellerName={selected.created_by ? sellerName.get(selected.created_by) ?? null : null}
                onBack={() => setSelectedId(null)}
                onDelete={() => setDeleteId(selected.id)}
                onDuplicate={() => setDuplicateFor(selected)}
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

      <DuplicateProposalDialog
        orgSlug={orgSlug}
        proposal={duplicateFor}
        contatos={contatos}
        onClose={() => setDuplicateFor(null)}
        onDone={(newId) => { setDuplicateFor(null); setSelectedId(newId); router.refresh() }}
      />
    </>
  )
}

function DuplicateProposalDialog({
  orgSlug, proposal, contatos, onClose, onDone,
}: {
  orgSlug: string
  proposal: ProposalRow | null
  contatos: Contato[]
  onClose: () => void
  onDone: (newId: string) => void
}) {
  const [q, setQ] = useState('')
  const [targetId, setTargetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset transient state whenever the dialog opens for a new proposal.
  useEffect(() => {
    if (proposal) { setQ(''); setTargetId(null); setSaving(false) }
  }, [proposal])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? contatos.filter(c => (c.name || '').toLowerCase().includes(needle))
      : contatos
    return list.slice(0, 50)
  }, [contatos, q])

  async function handleConfirm() {
    if (!proposal || !targetId) return
    setSaving(true)
    const res = await duplicateProposal(orgSlug, proposal.id, targetId)
    setSaving(false)
    if (!res.ok) { toast.error(res.error || 'Erro ao duplicar proposta'); return }
    toast.success('Cópia criada para o contato selecionado')
    onDone(res.data.id)
  }

  return (
    <Dialog open={!!proposal} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copiar proposta para outro lead</DialogTitle>
          <DialogDescription>
            Cria uma nova proposta com todo o conteúdo de
            {' '}<span className="font-medium text-foreground">{proposal?.title || 'proposta'}</span>{' '}
            vinculada ao contato escolhido. A nova cópia começa como rascunho e gera um novo link ao compartilhar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar contato pelo nome…"
              className="pl-8"
            />
          </div>
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y">
            {filtered.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">Nenhum contato encontrado.</p>
            ) : filtered.map(c => {
              const active = c.id === targetId
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setTargetId(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50',
                  )}
                >
                  <span className="truncate">{c.name || 'Sem nome'}</span>
                  {active && <CheckCircle2 className="w-4 h-4 shrink-0" />}
                </button>
              )
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!targetId || saving}>
            {saving
              ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Copiando…</>
              : <><CopyPlus className="w-4 h-4 mr-1.5" /> Criar cópia</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
  orgSlug, p, sellerName, onBack, onDelete, onDuplicate,
}: {
  orgSlug: string
  p: ProposalRow
  sellerName: string | null
  onBack: () => void
  onDelete: () => void
  onDuplicate: () => void
}) {
  const dest = destOf(p)
  const [publicUrl, setPublicUrl] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    if (p.public_token) setPublicUrl(`${window.location.origin}/p/${p.public_token}`)
  }, [p.public_token])

  const travelers = Array.isArray(p.travelers) ? p.travelers : []

  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800) }
    catch { toast.error('Não foi possível copiar') }
  }

  return (
    <div className="flex flex-col w-full">
      {/* header */}
      <div className="sticky top-0 bg-card/90 backdrop-blur border-b p-4 flex items-center gap-2 z-10">
        <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={onBack}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold truncate">{p.title || 'Proposta sem título'}</h2>
            <StatusTag orgSlug={orgSlug} proposalId={p.id} status={p.status} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <Button asChild size="sm" title="Abrir editor">
            <Link href={`/app/${orgSlug}/cotacoes/${p.id}`} aria-label="Abrir editor">
              <Pencil className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Abrir editor</span>
            </Link>
          </Button>
          {p.public_token && (
            <>
              <Button type="button" variant="outline" size="sm" asChild title="Abrir / PDF">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir / PDF">
                  <ExternalLink className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Abrir / PDF</span>
                </a>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={copyLink} title="Copiar link" aria-label="Copiar link">
                {copied ? <CheckCircle2 className="w-3.5 h-3.5 sm:mr-1.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 sm:mr-1.5" />}
                <span className="hidden sm:inline">{copied ? 'Copiado' : 'Copiar link'}</span>
              </Button>
            </>
          )}
          <Button
            type="button" variant="outline" size="sm"
            onClick={onDuplicate}
            title="Copiar proposta para outro lead/contato"
            aria-label="Copiar proposta para outro lead/contato"
          >
            <CopyPlus className="w-3.5 h-3.5 sm:mr-1.5" /> <span className="hidden sm:inline">Copiar p/ lead</span>
          </Button>
          <Button
            type="button" variant="outline" size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={onDelete}
            aria-label="Excluir proposta"
            title="Excluir proposta"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
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
          {sellerName && <DetailRow icon={UserCircle2} label="Vendedor" value={sellerName} />}
        </div>

        <p className="text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2">
          Cotação realizada em {fmtTimestamp(p.created_at)}. Preços e tarifas estão sujeitos a alterações sem aviso prévio.
        </p>

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

      </div>
    </div>
  )
}
