import { getExecutiveMetrics } from '@/actions/super-admin'
import { formatPrice } from '@/lib/billing/plans'
import {
  Building2, Users, TrendingUp, Activity, BarChart2, Sparkles,
  DollarSign, CreditCard, Wallet, AlertTriangle, ArrowUpRight,
} from 'lucide-react'
import Link from 'next/link'

const PLAN_META: Record<string, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'bg-slate-500' },
  starter:  { label: 'Starter',  color: 'bg-sky-500' },
  pro:      { label: 'Pro',      color: 'bg-violet-500' },
  business: { label: 'Business', color: 'bg-emerald-500' },
}

export default async function SuperAdminOverview() {
  const m = await getExecutiveMetrics()

  const revenueCards = [
    { label: 'MRR',              value: formatPrice(m.mrrCents),  icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-950/60', border: 'border-emerald-800/40' },
    { label: 'ARR (projetado)',  value: formatPrice(m.arrCents),  icon: TrendingUp, color: 'text-teal-400',    bg: 'bg-teal-950/60',    border: 'border-teal-800/40' },
    { label: 'Contas pagantes',  value: m.payingAccounts,         icon: CreditCard, color: 'text-indigo-400',  bg: 'bg-indigo-950/60',  border: 'border-indigo-800/40' },
    { label: 'Créditos IA (mês)',value: m.aiCreditsUsedMonth.toLocaleString('pt-BR'), icon: Wallet, color: 'text-fuchsia-400', bg: 'bg-fuchsia-950/60', border: 'border-fuchsia-800/40' },
  ]

  const kpis = [
    { label: 'Total de Contas', value: m.totalAccounts,                    icon: Wallet,     color: 'text-violet-400', bg: 'bg-violet-950/60', border: 'border-violet-800/40' },
    { label: 'Total de Orgs',   value: m.totalOrgs,                        icon: Building2,  color: 'text-sky-400',    bg: 'bg-sky-950/60',    border: 'border-sky-800/40' },
    { label: 'Orgs Ativas',     value: m.activeOrgs,                       icon: Activity,   color: 'text-emerald-400',bg: 'bg-emerald-950/60',border: 'border-emerald-800/40' },
    { label: 'Em Trial',        value: m.trialOrgs,                        icon: Sparkles,   color: 'text-amber-400',  bg: 'bg-amber-950/60',  border: 'border-amber-800/40' },
    { label: 'Usuários Únicos', value: m.totalUsers,                       icon: Users,      color: 'text-pink-400',   bg: 'bg-pink-950/60',   border: 'border-pink-800/40' },
    { label: 'Total de Leads',  value: m.totalLeads.toLocaleString('pt-BR'),icon: TrendingUp,color: 'text-cyan-400',   bg: 'bg-cyan-950/60',   border: 'border-cyan-800/40' },
    { label: 'Novas orgs (7d)', value: m.signups7d,                        icon: BarChart2,  color: 'text-lime-400',   bg: 'bg-lime-950/60',   border: 'border-lime-800/40' },
    { label: 'Novas orgs (30d)',value: m.signups30d,                       icon: BarChart2,  color: 'text-indigo-400', bg: 'bg-indigo-950/60', border: 'border-indigo-800/40' },
  ]

  const totalSubs = m.planDistribution.reduce((s, p) => s + p.count, 0) || 1

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral</h1>
          <p className="text-sm text-slate-500 mt-1">Métricas executivas da plataforma.</p>
        </div>
        {m.computedAt && (
          <p className="text-[11px] text-slate-600 font-mono shrink-0">
            atualizado {new Date(m.computedAt).toLocaleString('pt-BR')}
          </p>
        )}
      </div>

      {/* Critical alert banner */}
      {m.openCriticalAlerts > 0 && (
        <Link
          href="/super-admin/alertas"
          className="flex items-center gap-3 rounded-xl border border-red-800/50 bg-red-950/50 px-4 py-3 hover:bg-red-950/70 transition-colors"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <p className="text-sm text-red-200 flex-1">
            <span className="font-semibold">{m.openCriticalAlerts}</span> alerta{m.openCriticalAlerts === 1 ? '' : 's'} crítico{m.openCriticalAlerts === 1 ? '' : 's'} aberto{m.openCriticalAlerts === 1 ? '' : 's'}.
          </p>
          <ArrowUpRight className="w-4 h-4 text-red-400 shrink-0" />
        </Link>
      )}

      {/* Revenue row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {revenueCards.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 flex flex-col gap-2 ${k.bg} ${k.border}`}>
            <k.icon className={`w-4 h-4 ${k.color}`} />
            <p className="text-2xl font-bold text-white tabular-nums whitespace-nowrap">{k.value}</p>
            <p className="text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
        {kpis.map(k => (
          <div key={k.label} className={`rounded-xl border p-4 flex flex-col gap-2 ${k.bg} ${k.border}`}>
            <k.icon className={`w-4 h-4 ${k.color}`} />
            <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            <p className="text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Plan distribution */}
      <div className="rounded-xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Distribuição por plano (assinaturas ativas)</h2>
        {m.planDistribution.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhuma assinatura ativa.</p>
        ) : (
          <div className="space-y-3">
            {/* Stacked bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
              {m.planDistribution.map(p => (
                <div
                  key={p.plan}
                  className={PLAN_META[p.plan]?.color ?? 'bg-slate-500'}
                  style={{ width: `${(p.count / totalSubs) * 100}%` }}
                  title={`${PLAN_META[p.plan]?.label ?? p.plan}: ${p.count}`}
                />
              ))}
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {m.planDistribution.map(p => (
                <div key={p.plan} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-sm ${PLAN_META[p.plan]?.color ?? 'bg-slate-500'}`} />
                  <span className="text-xs text-slate-300">{PLAN_META[p.plan]?.label ?? p.plan}</span>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {p.count} · {Math.round((p.count / totalSubs) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { href: '/super-admin/orgs',     label: 'Gerenciar Organizações', desc: 'Editar planos, limites e impersonar' },
          { href: '/super-admin/audit',    label: 'Log de Auditoria',       desc: 'Histórico de acessos e alterações' },
          { href: '/super-admin/activate', label: 'Ativar Novo Cliente',    desc: 'Criar org Althos Managed e enviar convite' },
        ].map(l => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 p-4 transition-colors"
          >
            <p className="text-sm font-semibold text-white">{l.label}</p>
            <p className="text-xs text-slate-500 mt-1">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
