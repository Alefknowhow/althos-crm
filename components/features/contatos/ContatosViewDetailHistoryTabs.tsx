'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ContatoDeal } from '@/actions/contatos'
import { fmtCurrency, fmtDate, type Selected } from './ContatosViewShared'
import { DealCard } from './ContatosViewDetailHelpers'

export function NegociacoesTab({
  orgSlug, selected, isTravel, deals,
}: {
  orgSlug:  string
  selected: NonNullable<Selected>
  isTravel: boolean
  deals:    ContatoDeal[]
}) {
  // Nicho viagens: cotações (travel_proposals) ligadas ao lead, não o
  // histórico genérico de negocios (que é sobre movimento de pipeline,
  // não sobre o que foi efetivamente proposto ao cliente).
  if (isTravel) {
    return (selected.travelCotacoes || []).length > 0 ? (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Cotação</th>
              <th className="text-left font-medium px-3 py-2">Período</th>
              <th className="text-right font-medium px-3 py-2">Valor</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(selected.travelCotacoes || []).map((p: any) => (
              <tr key={p.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">
                  <Link href={`/app/${orgSlug}/cotacoes/${p.id}`} className="hover:underline">
                    {p.title || 'Cotação'}
                  </Link>
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {p.start_date ? `${fmtDate(p.start_date)} – ${fmtDate(p.end_date)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(p.total_cents || 0)}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{p.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma cotação registrada.</p>
    )
  }

  return deals.length > 0 ? (
    <div className="space-y-2">
      {deals.map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} />)}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma negociação registrada.</p>
  )
}

export function ComprasTab({
  orgSlug, selected, isTravel,
}: {
  orgSlug:  string
  selected: NonNullable<Selected>
  isTravel: boolean
}) {
  // Nicho viagens: reservas (travel_sales), não a tabela genérica
  // `sales` (que é de outros nichos e fica sempre vazia aqui).
  if (isTravel) {
    return (selected.travelReservas || []).length > 0 ? (
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data</th>
              <th className="text-left font-medium px-3 py-2">Destino</th>
              <th className="text-right font-medium px-3 py-2">Valor</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(selected.travelReservas || []).map((s: any) => (
              <tr key={s.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.created_at)}</td>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/app/${orgSlug}/reservas?sale=${s.id}`} className="hover:underline">
                    {s.destination || s.package_locator || s.sale_number || 'Reserva'}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.total_cents || 0)}</td>
                <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ) : (
      <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma reserva registrada.</p>
    )
  }

  return selected.sales.length > 0 ? (
    <div className="rounded-lg border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-xs text-muted-foreground">
          <tr>
            <th className="text-left font-medium px-3 py-2">Data</th>
            <th className="text-left font-medium px-3 py-2">Produto</th>
            <th className="text-right font-medium px-3 py-2">Valor</th>
            <th className="text-left font-medium px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {selected.sales.map(s => (
            <tr key={s.id}>
              <td className="px-3 py-2 text-muted-foreground">{fmtDate(s.sale_date)}</td>
              <td className="px-3 py-2 font-medium">{s.products?.name || 'Venda'}</td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums">{fmtCurrency(s.amount_cents)}</td>
              <td className="px-3 py-2"><Badge variant="outline" className="text-[10px]">{s.status}</Badge></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg">Nenhuma compra registrada.</p>
  )
}
