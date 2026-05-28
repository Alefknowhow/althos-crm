import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Trophy, Medal } from 'lucide-react'
import { getSellersRanking } from '@/actions/dashboard'
import { listOrgMembers } from '@/actions/sales'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    (cents || 0) / 100,
  )
}

const POSITION_COLORS = ['#f59e0b', '#94a3b8', '#a16207'] // gold, silver, bronze

/**
 * Top sellers by completed-sales value over the last 30 days.
 * Joins the seller_id from sales with the org's memberships to display
 * names rather than UUIDs.
 */
export default async function SellersRankingWidget({
  orgSlug,
  orgId,
}: {
  orgSlug: string
  orgId: string
}) {
  const [rows, members] = await Promise.all([
    getSellersRanking(orgId, { windowDays: 30 }),
    listOrgMembers(orgSlug),
  ])

  const memberById = new Map(members.map((m: any) => [m.id, m]))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          Ranking de Vendedores
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Últimos 30 dias. Vendas concluídas, por valor.
        </p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <p>Nenhuma venda no período.</p>
            <p className="text-[10px] mt-1">
              Vendedor é atribuído ao registrar uma venda em "Vendas".
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map((row, idx) => {
              const member = memberById.get(row.seller_id) as any
              const name = member?.name || 'Usuário removido'
              const isPodium = idx < 3
              const podiumColor = POSITION_COLORS[idx] || '#94a3b8'
              return (
                <div
                  key={row.seller_id}
                  className="flex items-center gap-3 p-2 rounded-md border hover:bg-muted/30 transition-colors"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{
                      backgroundColor: isPodium ? `${podiumColor}22` : 'hsl(var(--muted))',
                      color: isPodium ? podiumColor : 'hsl(var(--muted-foreground))',
                    }}
                  >
                    {isPodium ? <Medal className="w-3.5 h-3.5" /> : idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {row.total_sales} venda{row.total_sales !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="text-sm font-bold tabular-nums">
                    {fmtCurrency(row.total_value_cents)}
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
