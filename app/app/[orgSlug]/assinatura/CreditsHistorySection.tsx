import { Sparkles, Phone, Mail } from 'lucide-react'
import type { CreditsOverview, CreditLedgerRow } from '@/actions/billing-credits-overview'

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Coluna de histórico de consumo com scroll próprio — independente do
 *  histórico de faturas lá embaixo (pedido explícito: blocos de histórico
 *  cada um com seu scroll, sem um empurrar o layout do outro). */
function HistoryColumn({
  icon, title, rows, formatAmount,
}: {
  icon: React.ReactNode
  title: string
  rows: CreditLedgerRow[]
  formatAmount: (n: number) => string
}) {
  return (
    <div className="rounded-none border bg-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b flex items-center gap-2 shrink-0">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="divide-y max-h-64 overflow-y-auto">
        {rows.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Nenhum consumo ainda.</p>
        ) : (
          rows.map(r => {
            // 'purchased' e 'refund' são créditos entrando no saldo (verde,
            // "+"); qualquer outro tipo (usage/consumed legado) é consumo.
            const isCredit = r.type === 'purchased' || r.type === 'refund'
            return (
              <div key={r.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <div className="min-w-0 pr-2">
                  <p className="truncate">{r.detail}{r.type === 'refund' && ' (estorno)'}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(r.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
                <span className={`tabular-nums shrink-0 ${isCredit ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                  {isCredit ? '+' : '-'}{formatAmount(Math.abs(r.amount))}
                </span>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

export default function CreditsHistorySection({ overview }: { overview: CreditsOverview }) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-semibold text-sm">Histórico de consumo</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Últimos lançamentos de cada tipo de crédito — compras e consumo juntos, mais recente primeiro.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <HistoryColumn icon={<Sparkles className="w-4 h-4 text-primary" />} title="Althos Credits" rows={overview.ai.transactions} formatAmount={n => `${n} créd.`} />
        <HistoryColumn icon={<Phone className="w-4 h-4 text-primary" />} title="Voice Credits" rows={overview.voice.transactions} formatAmount={formatCents} />
        <HistoryColumn icon={<Mail className="w-4 h-4 text-primary" />} title="Email Credits" rows={overview.email.transactions} formatAmount={formatCents} />
      </div>
    </div>
  )
}
