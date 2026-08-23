import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { History, ShoppingBag } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { TrafficActivity } from '@/actions/trafego-history'

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

const ACTIVITY_LABEL: Record<string, (payload: any) => string> = {
  traffic_profile_updated: () => 'Estratégia do cliente atualizada',
  traffic_creative_status_changed: p => `Criativo "${p?.title || ''}" foi ${p?.status === 'aprovado' ? 'aprovado' : 'reprovado'} pelo cliente${p?.comment ? `: "${p.comment}"` : ''}`,
  manual_created: () => 'Cliente cadastrado',
}

function activityLabel(a: TrafficActivity): string {
  const fn = ACTIVITY_LABEL[a.type]
  if (fn) return fn(a.payload)
  return a.type
}

/** Histórico do cliente de tráfego: vendas registradas + timeline de eventos
 *  operacionais (contato_activities, Core), escopados só a este cliente. */
export default function ClientHistorySection({ sales, activities }: { sales: SaleRow[]; activities: TrafficActivity[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><History className="w-4 h-4" /> Timeline</CardTitle></CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {activities.map(a => (
                <div key={a.id} className="flex gap-3 border-b pb-3 last:border-0 last:pb-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm">{activityLabel(a)}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleString('pt-BR')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><ShoppingBag className="w-4 h-4" /> Vendas</CardTitle></CardHeader>
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
    </div>
  )
}
