'use client'

/**
 * Small table-header/action widgets and the entry details modal for
 * FinancialEntriesView. Split out of FinancialEntriesView.tsx.
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TableHead } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { cn, formatCurrency } from '@/lib/utils'
import type { FinancialEntryRow } from '@/actions/financial'
import {
  FileIcon, ImageIcon, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Pencil, ArrowUpDown,
} from 'lucide-react'
import { FOCUS_RING, STATUS_LABELS, STATUS_VARIANT, fmtDate } from './FinancialEntriesShared'

export function SortableHead({ label, active, dir, onClick, className }: { label: string; active: boolean; dir: 'asc' | 'desc'; onClick: () => void; className?: string }) {
  return (
    <TableHead className={className}>
      <button type="button" onClick={onClick} className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground font-medium')}>
        {label}
        {active ? (dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </button>
    </TableHead>
  )
}

export function IconAction({ icon: Icon, label, onClick, tone }: { icon: React.ElementType; label: string; onClick: () => void; tone?: 'destructive' }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className={cn(
              'w-7 h-7 inline-flex items-center justify-center rounded-md border border-transparent text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
              FOCUS_RING,
              tone === 'destructive' && 'hover:bg-destructive/10 hover:text-destructive',
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Skeleton de carregamento — compacto, usado pelo Suspense fallback da
 * página (ver app/app/[orgSlug]/financeiro/page.tsx).
 * ──────────────────────────────────────────────────────────────────────── */

export function FinancialEntriesSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 flex-1 max-w-xs" />
        <Skeleton className="h-9 w-[150px]" />
        <Skeleton className="h-9 w-[110px]" />
        <Skeleton className="h-9 w-[120px]" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
      <Skeleton className="h-96 w-full" />
    </div>
  )
}

/* ────────────────────────────────────────────────────────────────────────
 * Modal de detalhes — somente leitura + anexos, com atalho pra editar.
 * ──────────────────────────────────────────────────────────────────────── */

export function EntryDetailsModal({
  entry, open, onOpenChange, onEdit, onOpenAttachment,
}: {
  entry: FinancialEntryRow
  open: boolean
  onOpenChange: (o: boolean) => void
  onEdit: () => void
  onOpenAttachment: (path: string, isImage: boolean, name: string) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {entry.tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
            {entry.categoria}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-muted-foreground">Valor</p>
              <p className={cn('text-xl font-bold tabular-nums', entry.tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                {entry.tipo === 'despesa' ? '- ' : ''}{formatCurrency(entry.valor_cents)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[entry.status]}>{STATUS_LABELS[entry.status]}</Badge>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <div><dt className="text-[11px] text-muted-foreground">Data</dt><dd>{fmtDate(entry.competencia)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Vencimento</dt><dd>{fmtDate(entry.vencimento)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Data de pagamento</dt><dd>{fmtDate(entry.data_pagamento)}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Cliente/Fornecedor</dt><dd className="truncate">{entry.contato_nome || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Categoria</dt><dd className="truncate">{entry.categoria}{entry.subcategoria ? ` / ${entry.subcategoria}` : ''}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Centro de custo</dt><dd className="truncate">{entry.centro_custo || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Conta bancária</dt><dd className="truncate">{entry.conta_bancaria || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Forma de pagamento</dt><dd className="truncate">{entry.forma_pagamento || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Documento</dt><dd className="truncate">{entry.numero_documento || '—'}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Nota fiscal</dt><dd className="truncate">{entry.nota_fiscal || '—'}</dd></div>
          </dl>

          {entry.observacoes && (
            <div>
              <p className="text-[11px] text-muted-foreground mb-1">Observações</p>
              <p className="text-sm whitespace-pre-wrap">{entry.observacoes}</p>
            </div>
          )}

          <div>
            <p className="text-[11px] text-muted-foreground mb-1.5">Anexos</p>
            {entry.anexos?.length > 0 ? (
              <ul className="space-y-1.5">
                {entry.anexos.map((a, i) => {
                  const isPdf = a.mime_type === 'application/pdf'
                  const isImage = !isPdf && (a.mime_type?.startsWith('image/') ?? false)
                  const key = a.storage_object_id ?? a.path
                  return (
                    <li key={`${key}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                      {isPdf ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" /> : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                      <button type="button" onClick={() => onOpenAttachment(key!, isImage, a.name)} className="flex-1 min-w-0 truncate text-left text-xs text-foreground hover:underline">
                        {a.name}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nenhum anexo.</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={onEdit}><Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

