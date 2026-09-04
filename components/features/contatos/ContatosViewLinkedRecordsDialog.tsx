'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Loader2, ExternalLink, FileSignature, Plane } from 'lucide-react'
import {
  getContatoTravelLinks, type ContatoQuoteLink, type ContatoReservationLink,
} from '@/actions/contatos'
import { fmtDate, fmtCurrency, type ListRow } from './ContatosViewShared'

export function EmptyLinked({ label }: { label: string }) {
  return (
    <div className="py-10 text-center text-sm text-muted-foreground">{label}</div>
  )
}

/**
 * Popup listing a contato's linked quotes or reservations.
 * Split out of ContatosViewWidgets.tsx.
 */
export function LinkedRecordsDialog({
  orgSlug, target, onClose,
}: {
  orgSlug: string
  target: { kind: 'quotes' | 'reservations'; contato: ListRow } | null
  onClose: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [quotes, setQuotes] = useState<ContatoQuoteLink[]>([])
  const [reservations, setReservations] = useState<ContatoReservationLink[]>([])

  useEffect(() => {
    if (!target) return
    let cancelled = false
    setLoading(true)
    getContatoTravelLinks(orgSlug, target.contato.id)
      .then(res => {
        if (cancelled) return
        setQuotes(res.quotes)
        setReservations(res.reservations)
      })
      .catch(() => {
        if (!cancelled) toast.error('Não foi possível carregar os registros.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [target, orgSlug])

  const isQuotes = target?.kind === 'quotes'
  const title = isQuotes ? 'Cotações enviadas' : 'Reservas'

  return (
    <Dialog open={!!target} onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="sm:max-w-lg">
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              {isQuotes ? <FileSignature className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
              {title}
            </h2>
            {target && (
              <p className="text-sm text-muted-foreground">{target.contato.name}</p>
            )}
          </div>

          {loading ? (
            <div className="grid place-items-center py-10 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : isQuotes ? (
            quotes.length === 0 ? (
              <EmptyLinked label="Nenhuma cotação enviada para este contato." />
            ) : (
              <div className="divide-y rounded-lg border max-h-[60vh] overflow-y-auto">
                {quotes.map(q => (
                  <Link
                    key={q.id}
                    href={`/app/${orgSlug}/cotacoes/${q.id}`}
                    onClick={onClose}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="font-medium truncate">{q.title || 'Cotação'}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtDate(q.created_at)} · {q.status || '—'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-semibold tabular-nums">{fmtCurrency(q.total_cents)}</span>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : reservations.length === 0 ? (
            <EmptyLinked label="Nenhuma reserva para este contato." />
          ) : (
            <div className="divide-y rounded-lg border max-h-[60vh] overflow-y-auto">
              {reservations.map(r => (
                <Link
                  key={r.id}
                  href={`/app/${orgSlug}/reservas`}
                  onClick={onClose}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.destination || 'Reserva'}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.departure_date ? `Embarque ${fmtDate(r.departure_date)}` : fmtDate(r.created_at)} · {r.status || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold tabular-nums">{fmtCurrency(r.total_cents)}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
