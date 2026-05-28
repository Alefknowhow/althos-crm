'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteSale } from '@/actions/sales'
import { formatCurrency } from '@/lib/utils'
import SaleDialog from './SaleDialog'

type Sale = any
type Member = { id: string; name: string; email: string; role: string }
type Product = { id: string; name: string; type: string; price_cents: number }

interface Props {
  orgSlug: string
  sales: Sale[]
  members: Member[]
  products: Product[]
  currentUserId: string
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
}

export default function SalesTable({ orgSlug, sales, members, products, currentUserId }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const memberName = (id: string | null) => {
    if (!id) return '—'
    const m = members.find(x => x.id === id)
    return m ? m.name : '—'
  }

  const handleDelete = (id: string) => {
    if (!confirm('Excluir esta venda? Essa ação não pode ser desfeita.')) return
    startTransition(async () => {
      const res = await deleteSale(orgSlug, id)
      if (res.ok) {
        toast.success('Venda excluída')
        router.refresh()
      } else {
        toast.error(res.error || 'Erro ao excluir')
      }
    })
  }

  if (sales.length === 0) {
    return (
      <div className="p-12 text-center text-muted-foreground bg-muted/10 border rounded-xl">
        Nenhuma venda registrada ainda. Clique em <strong>Registrar venda</strong> para começar.
      </div>
    )
  }

  return (
    <div className="bg-card border rounded-xl overflow-hidden">
      {/* overflow-x-auto + hidden md:table-cell on secondary columns keeps
          the table usable on phones without forcing a full card layout. */}
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Item</TableHead>
            <TableHead className="hidden sm:table-cell">Lead</TableHead>
            <TableHead className="hidden lg:table-cell">Vendedor</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="hidden lg:table-cell">Pagamento</TableHead>
            <TableHead className="hidden md:table-cell">Status</TableHead>
            <TableHead className="w-[100px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sales.map(s => {
            const status = STATUS_LABEL[s.status] || STATUS_LABEL.completed
            return (
              <TableRow key={s.id}>
                <TableCell className="text-sm whitespace-nowrap">
                  {s.sale_date ? new Date(s.sale_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                </TableCell>
                <TableCell>
                  <div className="font-medium text-sm">{s.products?.name || '—'}</div>
                  {s.quantity > 1 && (
                    <div className="text-xs text-muted-foreground">×{s.quantity}</div>
                  )}
                  {/* Mobile-only inline lead + status (those columns are hidden). */}
                  <div className="sm:hidden text-xs text-muted-foreground mt-0.5">
                    {s.leads?.name || '—'}
                  </div>
                  <div className="md:hidden mt-1">
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-sm hidden sm:table-cell">{s.leads?.name || '—'}</TableCell>
                <TableCell className="text-sm hidden lg:table-cell">{memberName(s.seller_id)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {formatCurrency(s.amount_cents || 0)}
                </TableCell>
                <TableCell className="text-sm capitalize hidden lg:table-cell">
                  {s.payment_method || '—'}
                  {s.installments > 1 && <span className="text-xs text-muted-foreground"> · {s.installments}x</span>}
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <Badge variant="outline" className={status.className}>{status.label}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <SaleDialog
                      orgSlug={orgSlug}
                      members={members}
                      products={products}
                      currentUserId={currentUserId}
                      initial={s}
                      trigger={
                        <Button size="icon" variant="ghost" className="h-8 w-8">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      }
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(s.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
      </div>
    </div>
  )
}
