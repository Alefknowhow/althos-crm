'use client'

import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn, formatCurrency } from '@/lib/utils'
import { type FinancialEntryRow } from '@/actions/financial'
import {
  Repeat, CreditCard, Eye, Pencil, Trash2, CheckCircle2, Circle, TrendingUp, TrendingDown, Wallet,
} from 'lucide-react'
import { STATUS_LABELS, STATUS_VARIANT, fmtDate, type SortKey } from './FinancialEntriesShared'
import { SortableHead, IconAction } from './FinancialEntriesTableWidgets'

/**
 * Entries table (header + rows) for FinancialEntriesView. Split out of
 * FinancialEntriesView.tsx — purely presentational, row data/handlers
 * passed in as props.
 */
export function FinancialEntriesTable({
  pageRows, sort, toggleSort, onOpenDetails, onEdit, onDelete, onToggleStatus,
}: {
  pageRows: FinancialEntryRow[]
  sort: { key: SortKey; dir: 'asc' | 'desc' }
  toggleSort: (key: SortKey) => void
  onOpenDetails: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  onToggleStatus: (e: FinancialEntryRow) => void
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <SortableHead label="Data" active={sort.key === 'competencia'} dir={sort.dir} onClick={() => toggleSort('competencia')} />
            <TableHead>Descrição</TableHead>
            <TableHead>Cliente/Fornecedor</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Tipo</TableHead>
            <SortableHead label="Vencimento" active={sort.key === 'vencimento'} dir={sort.dir} onClick={() => toggleSort('vencimento')} />
            <SortableHead label="Valor" active={sort.key === 'valor_cents'} dir={sort.dir} onClick={() => toggleSort('valor_cents')} className="text-right" />
            <SortableHead label="Status" active={sort.key === 'status'} dir={sort.dir} onClick={() => toggleSort('status')} />
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pageRows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="h-40 text-center">
                <div className="flex flex-col items-center justify-center gap-1 text-muted-foreground py-6">
                  <Wallet className="w-6 h-6 opacity-40 mb-1" />
                  <p className="text-sm font-medium">Nenhum lançamento encontrado</p>
                  <p className="text-xs">Tente alterar os filtros ou realizar uma nova pesquisa.</p>
                </div>
              </TableCell>
            </TableRow>
          ) : pageRows.map(e => (
            <TableRow key={e.id} className="cursor-pointer" onClick={() => onOpenDetails(e.id)}>
              <TableCell className="whitespace-nowrap text-xs">{fmtDate(e.competencia)}</TableCell>
              <TableCell className="max-w-[220px]">
                <span className="truncate block text-sm">
                  {e.observacoes || e.categoria}
                  {e.is_recurring && <Repeat className="inline w-3 h-3 ml-1 text-muted-foreground align-[-1px]" aria-label="Recorrente" />}
                  {e.installment_group_id && <CreditCard className="inline w-3 h-3 ml-1 text-muted-foreground align-[-1px]" aria-label={`Parcela ${e.parcela_numero}/${e.parcela_total}`} />}
                </span>
              </TableCell>
              <TableCell className="max-w-[160px] text-xs text-muted-foreground truncate">{e.contato_nome || e.operadora || '—'}</TableCell>
              <TableCell className="text-xs">{e.categoria}</TableCell>
              <TableCell>
                {e.tipo === 'receita'
                  ? <span className="inline-flex items-center gap-1 text-xs text-success"><TrendingUp className="w-3.5 h-3.5" /> Receita</span>
                  : <span className="inline-flex items-center gap-1 text-xs text-destructive"><TrendingDown className="w-3.5 h-3.5" /> Despesa</span>}
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">{fmtDate(e.vencimento)}</TableCell>
              <TableCell className={cn('text-right text-sm font-semibold tabular-nums whitespace-nowrap', e.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                {e.tipo === 'despesa' ? '- ' : ''}{formatCurrency(e.valor_cents)}
              </TableCell>
              <TableCell><Badge variant={STATUS_VARIANT[e.status]} className="text-[10px] px-1.5 py-0">{STATUS_LABELS[e.status]}</Badge></TableCell>
              <TableCell onClick={ev => ev.stopPropagation()}>
                <div className="flex items-center justify-end gap-1">
                  <IconAction icon={Eye} label="Ver detalhes" onClick={() => onOpenDetails(e.id)} />
                  <IconAction icon={e.status === 'pago' ? Circle : CheckCircle2} label={e.status === 'pago' ? 'Marcar como pendente' : 'Marcar como pago'} onClick={() => onToggleStatus(e)} />
                  <IconAction icon={Pencil} label="Editar" onClick={() => onEdit(e.id)} />
                  <IconAction icon={Trash2} label="Excluir" tone="destructive" onClick={() => onDelete(e.id)} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
