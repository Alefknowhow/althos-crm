import { getAuditLogs } from '@/actions/super-admin'
import AuditExportButton from './AuditExportButton'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

const ACTION_META: Record<string, { label: string; class: string }> = {
  impersonate_start:       { label: 'Início impersonação',  class: 'bg-amber-950 text-amber-300 border-amber-800' },
  impersonate_end:         { label: 'Fim impersonação',     class: 'bg-slate-800  text-slate-400 border-slate-700' },
  update_limits:           { label: 'Limites editados',     class: 'bg-sky-950    text-sky-300   border-sky-800' },
  update_account_plan:     { label: 'Plano/limites da conta', class: 'bg-sky-950   text-sky-300   border-sky-800' },
  module_flag_toggle:      { label: 'Kill-switch de módulo', class: 'bg-violet-950 text-violet-300 border-violet-800' },
  grant_account_vertical:  { label: 'Vertical concedida',   class: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  revoke_account_vertical: { label: 'Vertical revogada',    class: 'bg-rose-950   text-rose-300   border-rose-800' },
}

function shortId(id: string): string {
  return `${id.slice(0, 8)}…`
}

export default async function AuditLogPage() {
  const logs = await getAuditLogs(200)

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Log de Auditoria</h1>
          <p className="text-sm text-slate-500 mt-1">
            Histórico de todas as ações executadas por super admins.
          </p>
        </div>
        <AuditExportButton logs={logs} />
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['Data / Hora', 'Ação', 'Super Admin', 'Alvo', 'Motivo', 'Detalhes'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => {
              const meta = ACTION_META[log.action] ?? { label: log.action, class: 'bg-slate-800 text-slate-400 border-slate-700' }
              const hasDiff = log.old_value != null || log.new_value != null
              return (
                <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors align-top">
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
                      <span className="text-slate-600 text-xs font-mono">{shortId(log.super_admin_user_id)}</span>
                    )}
                  </td>
                  {/* Alvo: organização OU conta — a ação pode ter uma, a
                      outra, ou nenhuma (target_organization_id é nullable
                      desde a migration 0265; ações em nível de conta como
                      update_account_plan/grant_account_vertical nunca
                      tiveram organização — achado da revisão automática
                      da PR #38, que antes quebrava a página inteira aqui). */}
                  <td className="px-4 py-3">
                    {log.org_name ? (
                      <>
                        <p className="text-white text-sm font-medium">{log.org_name}</p>
                        <p className="text-xs text-slate-600 font-mono">{log.org_slug}</p>
                      </>
                    ) : log.target_organization_id ? (
                      <span className="text-slate-600 text-xs font-mono">org {shortId(log.target_organization_id)}</span>
                    ) : log.account_name ? (
                      <p className="text-white text-sm font-medium">{log.account_name}</p>
                    ) : log.target_account_id ? (
                      <span className="text-slate-600 text-xs font-mono">conta {shortId(log.target_account_id)}</span>
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400 max-w-[240px]">
                    {log.reason || <span className="text-slate-700">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    {hasDiff ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-slate-500 hover:text-slate-300">ver</summary>
                        <div className="mt-1.5 space-y-1 font-mono text-[11px] max-w-[320px]">
                          {log.old_value != null && (
                            <p className="text-rose-400/80 whitespace-pre-wrap break-all">- {JSON.stringify(log.old_value)}</p>
                          )}
                          {log.new_value != null && (
                            <p className="text-emerald-400/80 whitespace-pre-wrap break-all">+ {JSON.stringify(log.new_value)}</p>
                          )}
                        </div>
                      </details>
                    ) : (
                      <span className="text-slate-700 text-xs">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
            {logs.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-slate-600 text-sm">
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
