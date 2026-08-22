import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

type SaleRow = {
  id: string
  sale_date: string | null
  amount_cents: number | null
  status: string
  products: { name: string } | null
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  cancelled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
}

/** Histórico do cliente de tráfego — vendas registradas, mesma fonte de
 *  dado (`sales`) já usada em Contatos, escopada só a este cliente. */
export default function ClientHistorySection({ sales }: { sales: SaleRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma venda registrada ainda.</p>
        ) : (
          <div className="divide-y">
            {sales.map(s => {
              const status = STATUS_LABEL[s.status] || STATUS_LABEL.completed
              return (
                <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">{s.products?.name || '—'}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.sale_date ? new Date(s.sale_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums font-medium">{formatCurrency(s.amount_cents || 0)}</span>
                    <Badge variant="outline" className={status.className}>{status.label}</Badge>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
