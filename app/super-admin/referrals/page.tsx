import { getReferralsOverview } from '@/actions/super-admin'
import ReferralActions from './ReferralActions'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Gift, Trophy, Clock, CheckCircle2, Award, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; class: string }> = {
  pending:   { label: 'Pendente',  class: 'bg-amber-950/60 text-amber-300 border-amber-800/40' },
  converted: { label: 'Convertido',class: 'bg-sky-950/60   text-sky-300   border-sky-800/40' },
  rewarded:  { label: 'Premiado',  class: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' },
}

export default async function ReferralsPage() {
  const data = await getReferralsOverview()

  const cards = [
    { label: 'Total de indicações', value: data.total,     icon: Gift,        color: 'text-violet-400',  bg: 'bg-violet-950/60',  border: 'border-violet-800/40' },
    { label: 'Pendentes',           value: data.pending,   icon: Clock,       color: 'text-amber-400',   bg: 'bg-amber-950/60',   border: 'border-amber-800/40' },
    { label: 'Convertidas',         value: data.converted, icon: CheckCircle2,color: 'text-sky-400',     bg: 'bg-sky-950/60',     border: 'border-sky-800/40' },
    { label: 'Premiadas',           value: data.rewarded,  icon: Award,       color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800/40' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Indicações</h1>
        <p className="text-sm text-slate-500 mt-1">Programa de indicações entre contas (referral).</p>
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

      {/* Top referrers */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Trophy className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Top indicadores</h2>
        </div>
        {data.topReferrers.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum indicador ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.topReferrers.map((r, i) => (
              <div key={r.account_id} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-center text-xs font-bold text-slate-500 tabular-nums">{i + 1}</span>
                <span className="text-white flex-1">{r.name}</span>
                <span className="font-mono text-[11px] text-slate-500">{r.code}</span>
                <span className="text-violet-300 tabular-nums font-medium">{r.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* All referrals */}
      <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white">Todas as indicações</h2>
        </div>
        {data.rows.length === 0 ? (
          <div className="p-12 text-center">
            <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-sm text-slate-400">Nenhuma indicação registrada.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5">Indicador</th>
                  <th className="text-left font-medium px-3 py-2.5">Indicado</th>
                  <th className="text-left font-medium px-3 py-2.5">Código</th>
                  <th className="text-left font-medium px-3 py-2.5">Recompensa</th>
                  <th className="text-left font-medium px-3 py-2.5">Data</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map(r => {
                  const meta = STATUS_META[r.status] ?? { label: r.status, class: 'bg-slate-800 text-slate-400 border-white/10' }
                  return (
                    <tr key={r.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                      <td className="px-5 py-2.5 text-white">{r.referrer_name}</td>
                      <td className="px-3 py-2.5 text-slate-300">{r.referred_name ?? <span className="text-slate-600">—</span>}</td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-slate-500">{r.referral_code}</td>
                      <td className="px-3 py-2.5 text-slate-400 text-xs">
                        {r.reward_type ?? '—'}{r.reward_value ? ` (${r.reward_value})` : ''}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500">{format(new Date(r.created_at), 'dd/MM/yy', { locale: ptBR })}</td>
                      <td className="px-3 py-2.5">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${meta.class}`}>{meta.label}</span>
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <ReferralActions id={r.id} status={r.status} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
