import { getGlobalMetrics } from '@/actions/super-admin'
import { Building2, Users, TrendingUp, Activity, BarChart2, Sparkles } from 'lucide-react'
import Link from 'next/link'

export default async function SuperAdminOverview() {
  const m = await getGlobalMetrics()

  const kpis = [
    {
      label:   'Total de Orgs',
      value:   m.totalOrgs,
      icon:    Building2,
      color:   'text-violet-400',
      bg:      'bg-violet-950/60',
      border:  'border-violet-800/40',
    },
    {
      label:   'Orgs Ativas',
      value:   m.activeOrgs,
      icon:    Activity,
      color:   'text-emerald-400',
      bg:      'bg-emerald-950/60',
      border:  'border-emerald-800/40',
    },
    {
      label:   'Em Trial / Free',
      value:   m.trialOrgs,
      icon:    Sparkles,
      color:   'text-amber-400',
      bg:      'bg-amber-950/60',
      border:  'border-amber-800/40',
    },
    {
      label:   'Total de Leads',
      value:   m.totalLeads.toLocaleString('pt-BR'),
      icon:    TrendingUp,
      color:   'text-sky-400',
      bg:      'bg-sky-950/60',
      border:  'border-sky-800/40',
    },
    {
      label:   'Usuários Únicos',
      value:   m.totalUsers,
      icon:    Users,
      color:   'text-pink-400',
      bg:      'bg-pink-950/60',
      border:  'border-pink-800/40',
    },
    {
      label:   'Novas orgs (30d)',
      value:   m.newOrgsLast30,
      icon:    BarChart2,
      color:   'text-indigo-400',
      bg:      'bg-indigo-950/60',
      border:  'border-indigo-800/40',
    },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral</h1>
        <p className="text-sm text-slate-500 mt-1">Métricas globais da plataforma em tempo real.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {kpis.map(k => (
          <div
            key={k.label}
            className={`rounded-xl border p-4 flex flex-col gap-2 ${k.bg} ${k.border}`}
          >
            <k.icon className={`w-4 h-4 ${k.color}`} />
            <p className="text-2xl font-bold text-white tabular-nums">{k.value}</p>
            <p className="text-xs text-slate-400">{k.label}</p>
          </div>
        ))}
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
