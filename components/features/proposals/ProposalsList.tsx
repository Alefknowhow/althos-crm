'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import EmptyState from '@/components/ui/empty-state'
import { formatCurrency } from '@/lib/utils'
import { createProposal, deleteProposal, type ProposalRow } from '@/actions/travel-proposals'
import { toast } from 'sonner'
import {
  FileSignature, Plus, MapPin, Users, CalendarRange, Trash2, Pencil,
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

function fmtDate(d: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
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

  async function handleCreate() {
    setCreating(true)
    const res = await createProposal(orgSlug, {})
    setCreating(false)
    if (!res.ok) {
      toast.error(res.error || 'Erro ao criar proposta')
      return
    }
    router.push(`/app/${orgSlug}/proposta/${res.data.id}`)
  }

  async function handleDelete(id: string) {
    const res = await deleteProposal(orgSlug, id)
    if (res.ok) {
      toast.success('Proposta excluída')
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
        actionLabel="Nova proposta"
        actionHref="#"
      >
        <Button size="lg" className="mt-4" onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Nova proposta'}
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={handleCreate} disabled={creating}>
          <Plus className="w-4 h-4 mr-2" /> {creating ? 'Criando…' : 'Nova proposta'}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {proposals.map(p => {
          const st = STATUS[p.status] || STATUS.draft
          const dest = (p.destinations || []).map((d: any) => d?.name).filter(Boolean).join(', ')
          return (
            <Card key={p.id} className="group relative overflow-hidden">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/app/${orgSlug}/proposta/${p.id}`}
                    className="font-semibold leading-tight hover:underline line-clamp-2"
                  >
                    {p.title || 'Proposta sem título'}
                  </Link>
                  <Badge variant="outline" className={st.cls}>{st.label}</Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {p.client_name && (
                    <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {p.client_name}</div>
                  )}
                  {dest && (
                    <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> <span className="truncate">{dest}</span></div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <CalendarRange className="w-3.5 h-3.5" /> {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                  </div>
                </div>

                <div className="flex items-center justify-between border-t pt-3">
                  <span className="text-base font-bold tabular-nums">{formatCurrency(p.total_cents || 0)}</span>
                  <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button size="sm" variant="ghost" asChild className="h-7 px-2">
                      <Link href={`/app/${orgSlug}/proposta/${p.id}`}><Pencil className="w-3.5 h-3.5" /></Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-destructive hover:bg-destructive/10"
                      onClick={() => setDeleteId(p.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
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
    </div>
  )
}
