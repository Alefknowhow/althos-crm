'use client'

/**
 * Lista de Reservas em tabela — mesmo padrão visual da lista de Cotações
 * (ProposalsList.tsx): tabela em tela cheia (sem o painel de detalhe ao
 * lado) com colunas ricas e ações por ícone no mesmo estilo do resto do
 * app (Button variant="outline" size="icon"). Extraído de
 * TravelSalesView.tsx pra manter o arquivo dentro do limite de linhas.
 */

import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { MapPin, Building2, Ticket, ExternalLink, Trash2 } from 'lucide-react'
import type { TravelSaleRow } from '@/actions/travel-sales'

function fmtDate(d?: string | null) {
  if (!d) return '—'
  return new Date(d + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function formatCurrency(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function TravelSalesListTable({
  sales, sellerName, onOpen, onDelete,
}: {
  sales: TravelSaleRow[]
  sellerName: Map<string, string>
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (sales.length === 0) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Nenhuma venda encontrada com esses filtros.
      </div>
    )
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Cliente</TableHead>
          <TableHead className="hidden lg:table-cell">Destino</TableHead>
          <TableHead className="hidden md:table-cell whitespace-nowrap">Ida → Volta</TableHead>
          <TableHead className="hidden xl:table-cell">Operadora</TableHead>
          <TableHead className="hidden xl:table-cell">Localizador</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="hidden md:table-cell">Status</TableHead>
          <TableHead className="hidden lg:table-cell">Responsável</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sales.map(s => {
          const seller = s.created_by ? sellerName.get(s.created_by) : null
          const cancelled = s.status === 'cancelled'
          return (
            <TableRow key={s.id} className="cursor-pointer" onClick={() => onOpen(s.id)}>
              <TableCell className="max-w-[220px]">
                <span className="font-medium text-sm truncate block">{s.client_name || 'Cliente'}</span>
              </TableCell>
              <TableCell className="hidden lg:table-cell max-w-[180px]">
                {s.destination ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                    <MapPin className="w-3 h-3 shrink-0" /> <span className="truncate">{s.destination}</span>
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                {(s.departure_date || s.return_date) ? `${fmtDate(s.departure_date)} → ${fmtDate(s.return_date)}` : '—'}
              </TableCell>
              <TableCell className="hidden xl:table-cell max-w-[140px]">
                {s.operator ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                    <Building2 className="w-3 h-3 shrink-0" /> <span className="truncate">{s.operator}</span>
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="hidden xl:table-cell max-w-[140px]">
                {s.package_locator ? (
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono truncate">
                    <Ticket className="w-3 h-3 shrink-0 font-sans" /> <span className="truncate">{s.package_locator}</span>
                  </span>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell className="text-right text-xs font-medium tabular-nums whitespace-nowrap">
                {formatCurrency(s.total_cents || 0)}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <span className={cn(
                  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap',
                  cancelled ? 'bg-destructive text-destructive-foreground' : 'bg-success text-success-foreground',
                )}>
                  {cancelled ? 'Cancelada' : 'Ativa'}
                </span>
              </TableCell>
              <TableCell className="hidden lg:table-cell">
                {seller ? (
                  <span className="text-xs text-muted-foreground truncate max-w-[110px] block">{seller}</span>
                ) : <span className="text-xs text-muted-foreground">—</span>}
              </TableCell>
              <TableCell onClick={ev => ev.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    title="Abrir"
                    aria-label="Abrir"
                    className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-8 w-8 shrink-0')}
                    onClick={() => onOpen(s.id)}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    title="Excluir"
                    aria-label="Excluir"
                    className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-8 w-8 shrink-0 text-destructive hover:text-destructive')}
                    onClick={() => onDelete(s.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
