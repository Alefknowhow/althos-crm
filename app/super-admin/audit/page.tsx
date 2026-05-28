import { getAuditLogs } from '@/actions/super-admin'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ACTION_META: Record<string, { label: string; class: string }> = {
  impersonate_start: { label: 'Início impersonação', class: 'bg-amber-950 text-amber-300 border-amber-800' },
  impersonate_end:   { label: 'Fim impersonação',    class: 'bg-slate-800  text-slate-400 border-slate-700' },
  update_limits:     { label: 'Limites editados',    class: 'bg-sky-950    text-sky-300   border-sky-800' },
}

export default async function AuditLogPage() {
  const logs = await getAuditLogs(200)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Log de Auditoria</h1>
        <p className="text-sm text-slate-500 mt-1">
          Histórico de todas as ações executadas por super admins.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['Data / Hora', 'Ação', 'Super Admin', 'Organização'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const meta = ACTION_META[log.action] ?? { label: log.action, class: 'bg-slate-800 text-slate-400 border-slate-700' }
              return (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3 text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.class}`}>
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {log.super_admin_email ? (
                      <span className="text-slate-300 text-xs">{log.super_admin_email}</span>
                    ) : (
                      <span className="text-slate-600 text-xs font-mono">{log.super_admin_user_id.slice(0, 8)}…</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {log.org_name ? (
                      <>
                        <p className="text-white text-sm font-medium">{log.org_name}</p>
                        <p className="text-xs text-slate-600 font-mono">{log.org_slug}</p>
                      </>
                    ) : (
                      <span className="text-slate-600 text-xs font-mono">{log.target_organization_id.slice(0, 8)}…</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-slate-600 text-sm">
                  Nenhum log encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
