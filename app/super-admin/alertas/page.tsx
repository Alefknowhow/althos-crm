import { getSystemAlerts } from '@/actions/super-admin'
import AlertActions from './AlertActions'
import Link from 'next/link'
import { AlertTriangle, AlertCircle, Info, Inbox } from 'lucide-react'

export const dynamic = 'force-dynamic'

const SEVERITY: Record<string, { icon: any; color: string; bg: string; border: string; label: string }> = {
  critical: { icon: AlertTriangle, color: 'text-red-400',   bg: 'bg-red-950/40',   border: 'border-red-800/40',   label: 'Crítico' },
  warning:  { icon: AlertCircle,   color: 'text-amber-400', bg: 'bg-amber-950/40', border: 'border-amber-800/40', label: 'Atenção' },
  info:     { icon: Info,          color: 'text-sky-400',   bg: 'bg-sky-950/40',   border: 'border-sky-800/40',   label: 'Info' },
}

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const filter = searchParams.filter === 'all' ? 'all' : 'open'
  const { alerts, counts } = await getSystemAlerts(filter)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Central de Alertas</h1>
          <p className="text-sm text-slate-500 mt-1">Alertas operacionais e de saúde da plataforma.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full border border-red-800/40 bg-red-950/40 px-2.5 py-1 text-red-300 tabular-nums">
            {counts.critical} crítico{counts.critical === 1 ? '' : 's'}
          </span>
          <span className="rounded-full border border-amber-800/40 bg-amber-950/40 px-2.5 py-1 text-amber-300 tabular-nums">
            {counts.warning} atenção
          </span>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="inline-flex rounded-lg border border-white/10 bg-white/5 p-0.5">
        <Link
          href="/super-admin/alertas"
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'open' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Abertos ({counts.open})
        </Link>
        <Link
          href="/super-admin/alertas?filter=all"
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            filter === 'all' ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          Todos
        </Link>
      </div>

      {/* List */}
      {alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
          <Inbox className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">
            {filter === 'open' ? 'Nenhum alerta aberto. Tudo certo!' : 'Nenhum alerta registrado.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => {
            const sev = SEVERITY[a.severity] ?? SEVERITY.info
            return (
              <div
                key={a.id}
                className={`rounded-xl border p-4 flex items-start gap-3 ${sev.bg} ${sev.border} ${
                  a.status === 'resolved' ? 'opacity-60' : ''
                }`}
              >
                <sev.icon className={`w-5 h-5 shrink-0 mt-0.5 ${sev.color}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white">{a.title}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${sev.bg} ${sev.color} border ${sev.border}`}>
                      {sev.label}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">{a.type}</span>
                    {a.status === 'acknowledged' && (
                      <span className="text-[10px] text-slate-400">· reconhecido</span>
                    )}
                  </div>
                  {a.message && <p className="text-sm text-slate-400 mt-1">{a.message}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                    <span>{new Date(a.created_at).toLocaleString('pt-BR')}</span>
                    {a.org_name && (
                      <Link
                        href={`/super-admin/orgs?q=${encodeURIComponent(a.org_slug ?? a.org_name)}`}
                        className="text-violet-400 hover:underline"
                      >
                        {a.org_name}
                      </Link>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <AlertActions alertId={a.id} status={a.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
