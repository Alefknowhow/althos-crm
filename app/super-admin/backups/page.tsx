import { listBackupRuns, getBackupStatus, type BackupRunRow } from '@/actions/backup'
import { CheckCircle2, XCircle, AlertTriangle, Loader2, Database, HardDrive } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS: Record<string, { icon: any; color: string; label: string }> = {
  success: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Sucesso' },
  failed:  { icon: XCircle,      color: 'text-red-400',     label: 'Falhou' },
  invalid: { icon: AlertTriangle,color: 'text-amber-400',   label: 'Inválido' },
  running: { icon: Loader2,      color: 'text-sky-400',     label: 'Em andamento' },
}

function formatBytes(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function StatusCard({ title, icon: Icon, run }: { title: string; icon: any; run: BackupRunRow | null }) {
  const st = run ? STATUS[run.status] ?? STATUS.running : null
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center gap-2 text-sm text-slate-400 mb-3">
        <Icon className="w-4 h-4" /> {title}
      </div>
      {!run ? (
        <p className="text-sm text-slate-500">Nenhum backup rodou ainda.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-2">
            {st && <st.icon className={`w-4 h-4 ${st.color}`} />}
            <span className={`text-sm font-medium ${st?.color ?? 'text-white'}`}>{st?.label ?? run.status}</span>
          </div>
          <div className="text-xs text-slate-500 space-y-1">
            <div>Último: {new Date(run.started_at).toLocaleString('pt-BR')}</div>
            {run.duration_ms != null && <div>Duração: {(run.duration_ms / 1000).toFixed(1)}s</div>}
            {run.database_size_bytes != null && <div>Tamanho (banco): {formatBytes(run.database_size_bytes)}</div>}
            {run.storage_object_count != null && <div>Objetos copiados: {run.storage_object_count}</div>}
            {run.storage_bytes != null && <div>Tamanho (storage): {formatBytes(run.storage_bytes)}</div>}
            {run.error_message && <div className="text-red-400 mt-1">{run.error_message}</div>}
          </div>
        </>
      )}
    </div>
  )
}

export default async function BackupsPage() {
  const [status, runs] = await Promise.all([getBackupStatus(), listBackupRuns(30)])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Backup & Disaster Recovery</h1>
        <p className="text-sm text-slate-500 mt-1">
          Status dos backups automáticos (banco + storage). Fase 1 — só leitura, sem restore ainda.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatusCard title="Banco de dados (diário, 03:00 UTC)" icon={Database} run={status?.lastDatabaseRun ?? null} />
        <StatusCard title="Storage (diário, 03:30 UTC)" icon={HardDrive} run={status?.lastStorageRun ?? null} />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-white mb-3">Histórico recente</h2>
        {runs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-12 text-center">
            <p className="text-sm text-slate-400">Nenhuma execução registrada ainda — o primeiro cron roda às 03:00 UTC.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 text-xs border-b border-white/10">
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Início</th>
                  <th className="px-4 py-2 font-medium">Duração</th>
                  <th className="px-4 py-2 font-medium">Tamanho</th>
                  <th className="px-4 py-2 font-medium">Disparo</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => {
                  const st = STATUS[r.status] ?? STATUS.running
                  const size = r.type === 'database' ? r.database_size_bytes : r.storage_bytes
                  return (
                    <tr key={r.id} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2 text-slate-300">{r.type === 'database' ? 'Banco' : 'Storage'}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center gap-1.5 ${st.color}`}>
                          <st.icon className="w-3.5 h-3.5" /> {st.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-400">{new Date(r.started_at).toLocaleString('pt-BR')}</td>
                      <td className="px-4 py-2 text-slate-400">{r.duration_ms != null ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                      <td className="px-4 py-2 text-slate-400">{formatBytes(size)}</td>
                      <td className="px-4 py-2 text-slate-500 text-xs">{r.triggered_by === 'cron' ? 'Automático' : 'Manual'}</td>
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
