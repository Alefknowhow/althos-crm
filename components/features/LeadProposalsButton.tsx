'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { listProposalsForLead, type LeadProposalRow } from '@/actions/travel-proposals'
import { formatCurrency } from '@/lib/utils'
import { FileText, Loader2, ExternalLink, CalendarRange } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: 'Rascunho', cls: 'bg-slate-100 text-slate-600' },
  sent: { label: 'Enviada', cls: 'bg-sky-100 text-sky-700' },
  accepted: { label: 'Aceita', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: 'Recusada', cls: 'bg-rose-100 text-rose-700' },
}

function fmtDate(d?: string | null) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—'
}

/**
 * Small icon button for a pipeline card that opens a floating window listing all
 * cotações (travel proposals) linked to the lead, each linking to its editor.
 */
export default function LeadProposalsButton({
  orgSlug,
  leadId,
}: {
  orgSlug: string
  leadId: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [proposals, setProposals] = useState<LeadProposalRow[] | null>(null)

  function stop(e: React.MouseEvent | React.PointerEvent) {
    e.stopPropagation()
  }

  async function load() {
    setLoading(true)
    try {
      const data = await listProposalsForLead(orgSlug, leadId)
      setProposals(data)
    } finally {
      setLoading(false)
    }
  }

  function openDialog(e: React.MouseEvent) {
    stop(e)
    setOpen(true)
    if (!proposals) load()
  }

  return (
    <>
      <button
        type="button"
        onPointerDown={stop}
        onClick={openDialog}
        title="Ver cotações do lead"
        className="flex h-6 w-6 items-center justify-center rounded-md text-amber-600 hover:bg-amber-50"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg" onPointerDown={stop} onClick={stop}>
          <DialogHeader>
            <DialogTitle>Cotações do lead</DialogTitle>
          </DialogHeader>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          )}

          {!loading && proposals && proposals.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma cotação vinculada a este lead.
            </div>
          )}

          {!loading && proposals && proposals.length > 0 && (
            <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {proposals.map(p => {
                const st = STATUS[p.status] || STATUS.draft
                return (
                  <Link
                    key={p.id}
                    href={`/app/${orgSlug}/cotacoes/${p.id}`}
                    className="group flex items-center gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40 hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{p.title || 'Proposta sem título'}</span>
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${st.cls}`}>
                          {st.label}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                        {(p.start_date || p.end_date) && (
                          <span className="flex items-center gap-1">
                            <CalendarRange className="h-3 w-3" />
                            {fmtDate(p.start_date)} – {fmtDate(p.end_date)}
                          </span>
                        )}
                        <span>
                          Atualizada {format(new Date(p.updated_at), "d MMM yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums">
                      {formatCurrency(p.total_cents || 0)}
                    </span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" />
                  </Link>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
