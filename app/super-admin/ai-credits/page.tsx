import { getAiCreditsOverview } from '@/actions/super-admin'
import ExportCsvButton from './ExportCsvButton'
import { Sparkles, Wallet, TrendingDown, Coins } from 'lucide-react'

export const dynamic = 'force-dynamic'

const ACTION_LABELS: Record<string, string> = {
  whatsapp_ai_reply:  'WhatsApp IA',
  instagram_ai_reply: 'Instagram IA',
  lead_scoring:       'Qualificação de leads',
  ai_insights:        'Insights IA',
  report_generation:  'Geração de relatórios',
}

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
}

export default async function AiCreditsPage({
  searchParams,
}: {
  searchParams: { period?: string }
}) {
  const data = await getAiCreditsOverview(searchParams.period)
  const maxAction = Math.max(1, ...data.byAction.map(a => a.used))

  const cards = [
    { label: 'Créditos usados',    value: data.totalUsed,      icon: TrendingDown, color: 'text-fuchsia-400', bg: 'bg-fuchsia-950/60', border: 'border-fuchsia-800/40' },
    { label: 'Incluídos (planos)', value: data.totalIncluded,  icon: Wallet,       color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800/40' },
    { label: 'Comprados (extra)',  value: data.totalPurchased, icon: Coins,        color: 'text-amber-400',   bg: 'bg-amber-950/60',   border: 'border-amber-800/40' },
    { label: 'Contas com consumo', value: data.accounts.filter(a => a.used > 0).length, icon: Sparkles, color: 'text-violet-400', bg: 'bg-violet-950/60', border: 'border-violet-800/40' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Créditos de IA</h1>
          <p className="text-sm text-slate-500 mt-1 capitalize">Consumo em {monthLabel(data.period)}.</p>
        </div>
        <ExportCsvButton rows={data.accounts} period={data.period} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {cards.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 flex flex-col gap-2 ${k.bg} ${k.border}`}>
            <k.icon className={`w-4 h-4 ${k.color}`} />
            <p className="text-2xl font-bold text-white tabular-nums">{k.value.toLocaleString('pt-BR')}</p>
            <p className="text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Consumption by action */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Consumo por tipo de ação</h2>
        {data.byAction.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum consumo registrado neste período.</p>
        ) : (
          <div className="space-y-3">
            {data.byAction.map(a => (
              <div key={a.action} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">{ACTION_LABELS[a.action] ?? a.action}</span>
                  <span className="text-slate-400 tabular-nums">{a.used.toLocaleString('pt-BR')}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-fuchsia-500" style={{ width: `${(a.used / maxAction) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Per-account table */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Consumo por conta</h2>
        </div>
        {data.accounts.length === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Sem dados de créditos neste período.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5">Conta</th>
                  <th className="text-left font-medium px-3 py-2.5">Plano</th>
                  <th className="text-right font-medium px-3 py-2.5">Incluídos</th>
                  <th className="text-right font-medium px-3 py-2.5">Comprados</th>
                  <th className="text-right font-medium px-3 py-2.5">Usados</th>
                  <th className="text-right font-medium px-5 py-2.5">Restantes</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map(a => (
                  <tr key={a.account_id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                    <td className="px-5 py-2.5 text-white">{a.name}</td>
                    <td className="px-3 py-2.5 text-slate-400 capitalize">{a.plan}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{a.included.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{a.purchased.toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-2.5 text-right text-white tabular-nums">{a.used.toLocaleString('pt-BR')}</td>
                    <td className={`px-5 py-2.5 text-right tabular-nums ${a.remaining <= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {a.remaining.toLocaleString('pt-BR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
