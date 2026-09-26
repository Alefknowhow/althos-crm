'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import type { ContatoDeal } from '@/actions/contatos'
import { fmtCurrency, fmtDate, type Selected } from './ContatosViewShared'
import { DealCard } from './ContatosViewDetailHelpers'

const DEAL_FILTERS = [
  { key: 'todos', label: 'Todos' },
  { key: 'open', label: 'Em aberto' },
  { key: 'won', label: 'Ganhos' },
  { key: 'lost', label: 'Perdidos' },
] as const
type DealFilter = typeof DEAL_FILTERS[number]['key']

/** Negócios — unifica negociações (pipeline) e vendas. Um negócio "ganho"
 *  é representado como venda: junto do card do negócio, mostra o registro
 *  de venda/reserva correspondente (valor, data de fechamento, forma de
 *  pagamento) quando existir. Diferente da antiga aba Vendas (removida na
 *  issue #63), aqui não há mais uma aba separada — é tudo negócio. */
export function NegociacoesTab({
  deals, members, orgSlug, selected, isTravel,
}: {
  deals: ContatoDeal[]
  members?: { id: string; name: string }[]
  orgSlug: string
  selected: NonNullable<Selected>
  isTravel: boolean
}) {
  const [filter, setFilter] = useState<DealFilter>('todos')

  const openCount = deals.filter(d => d.status === 'open').length
  const openValue = deals.filter(d => d.status === 'open').reduce((a, d) => a + (d.value_cents || 0), 0)

  const filteredDeals = useMemo(
    () => filter === 'todos' ? deals : deals.filter(d => d.status === filter),
    [deals, filter],
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{openCount} negócio{openCount === 1 ? '' : 's'} em aberto</span>
          {openValue > 0 && <> · {fmtCurrency(openValue)}</>}
        </p>
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted w-fit">
          {DEAL_FILTERS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 h-7 px-3 rounded-full text-xs font-semibold transition-colors ${
                filter === f.key ? 'bg-card shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filteredDeals.length > 0 ? (
        <div className="space-y-2">
          {filteredDeals.map(d => <DealCard key={d.id} d={d} fmtCurrency={fmtCurrency} fmtDate={fmtDate} members={members} />)}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4 rounded-lg bg-card">Nenhum negócio nessa categoria.</p>
      )}

      {/* Negócio ganho = venda: quando o filtro inclui "Ganhos", mostra o
          registro de venda/reserva correspondente (valor fechado, forma de
          pagamento), fonte real desses dados (não vive na tabela `negocios`). */}
      {(filter === 'todos' || filter === 'won') && (
        <div>
          <h3 className="text-sm font-bold mb-2">Vendas realizadas</h3>
          <ComprasTab orgSlug={orgSlug} selected={selected} isTravel={isTravel} />
        </div>
      )}
    </div>
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
