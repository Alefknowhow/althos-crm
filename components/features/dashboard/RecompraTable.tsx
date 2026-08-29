import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Repeat } from 'lucide-react'
import { getRecompraRanking } from '@/actions/dashboard-tabs'
import { OpenWabaButton } from '../LeadCard'

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format((cents || 0) / 100)
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('pt-BR')
}

// ~15 linhas visíveis (linha de ~40px + cabeçalho) antes de rolar dentro do
// próprio card — segue a mesma regra de tamanho fixo do resto do dashboard.
const TABLE_H = 'h-[640px]'

/**
 * Rank de "quem está há mais tempo sem comprar de novo" — insight pra call
 * de reativação da base. Só aparece pro nicho viagens (getRecompraRanking
 * retorna null pros demais, e o componente simplesmente não renderiza nada).
 */
export default async function RecompraTable({ orgSlug, orgId }: { orgSlug: string; orgId: string }) {
  const rows = await getRecompraRanking(orgId)
  if (rows === null) return null

  return (
    <Card className={`${TABLE_H} flex flex-col overflow-hidden`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Repeat className="w-4 h-4 text-amber-600" />
          Rank de recompra — clientes há mais tempo sem viajar de novo
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Ordenado por dias desde a última compra (o primeiro é quem está parado há mais tempo). Use para priorizar a call de reativação da base.
        </p>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 overflow-y-auto p-0">
        {rows.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Nenhum cliente com compra concluída ainda.
          </div>
        ) : (
          <div className="flex justify-center">
            <table className="w-auto text-sm border border-border">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="text-xs text-muted-foreground divide-x divide-border border-b border-border">
                  <th className="font-medium px-3 py-2 text-center">Nome</th>
                  <th className="font-medium px-3 py-2 text-center">Destino</th>
                  <th className="font-medium px-3 py-2 text-center">Mês da viagem</th>
                  <th className="font-medium px-3 py-2 text-center">Valor</th>
                  <th className="font-medium px-3 py-2 text-center">Comissão</th>
                  <th className="font-medium px-3 py-2 text-center">Pagamento</th>
                  <th className="font-medium px-3 py-2 text-center">Última compra</th>
                  <th className="font-medium px-3 py-2 text-center">Dias sem comprar</th>
                  <th className="font-medium px-2 py-2 text-center w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(r => (
                  <tr key={r.contato_id} className="hover:bg-muted/30 divide-x divide-border">
                    <td className="px-3 py-2 text-center font-medium truncate max-w-[160px]">{r.name}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground truncate max-w-[120px]">{r.destination || '—'}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground capitalize whitespace-nowrap">{r.travel_month || '—'}</td>
                    <td className="px-3 py-2 text-center tabular-nums whitespace-nowrap">{fmtCurrency(r.total_cents)}</td>
                    <td className="px-3 py-2 text-center tabular-nums whitespace-nowrap text-emerald-700 dark:text-emerald-400">{fmtCurrency(r.commission_cents)}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground truncate max-w-[140px]">{r.payment_method || '—'}</td>
                    <td className="px-3 py-2 text-center text-muted-foreground whitespace-nowrap">{fmtDate(r.last_sale_date)}</td>
                    <td className="px-3 py-2 text-center tabular-nums font-semibold whitespace-nowrap">
                      {r.days_since_last_sale}d
                    </td>
                    <td className="px-2 py-2 text-center">
                      <OpenWabaButton orgSlug={orgSlug} leadId={r.contato_id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
