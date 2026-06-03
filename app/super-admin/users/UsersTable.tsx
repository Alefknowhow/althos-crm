'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, ShieldCheck, ShieldOff, Building2 } from 'lucide-react'
import { setUserSuperAdmin, type PlatformUser } from '@/actions/super-admin'

export default function UsersTable({ users }: { users: PlatformUser[] }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [onlyAdmins, setOnlyAdmins] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return users.filter(u => {
      const matchQ = !q ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.full_name || '').toLowerCase().includes(q) ||
        u.accounts.some(a => a.name.toLowerCase().includes(q))
      return matchQ && (!onlyAdmins || u.is_super_admin)
    })
  }, [users, query, onlyAdmins])

  function toggleAdmin(u: PlatformUser) {
    const next = !u.is_super_admin
    if (next && !confirm(`Conceder acesso de SUPER ADMIN a ${u.email}? Isso dá acesso total à plataforma.`)) return
    if (!next && !confirm(`Remover acesso de super admin de ${u.email}?`)) return
    setError(null)
    setPendingId(u.id)
    startTransition(async () => {
      const res = await setUserSuperAdmin(u.id, next)
      setPendingId(null)
      if (!res.ok) { setError(res.error); return }
      router.refresh()
    })
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            placeholder="Buscar por email, nome ou conta…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={onlyAdmins} onChange={e => setOnlyAdmins(e.target.checked)} className="accent-violet-600" />
          Apenas super admins
        </label>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} usuário{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {['Usuário', 'Contas', 'Orgs', 'Criado', 'Último acesso', 'Super Admin'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(u => (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white font-medium">{u.full_name || '—'}</p>
                    <p className="text-xs text-slate-500">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {u.accounts.length === 0 ? (
                      <span className="text-xs text-slate-600">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {u.accounts.map(a => (
                          <span key={a.id} className="inline-flex items-center gap-1 text-xs text-slate-300">
                            <Building2 className="w-3 h-3 text-slate-500" /> {a.name}
                            <span className="text-[10px] text-slate-600">({a.role})</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">{u.org_count}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{format(new Date(u.created_at), 'dd/MM/yy', { locale: ptBR })}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {u.last_sign_in_at ? format(new Date(u.last_sign_in_at), 'dd/MM/yy HH:mm', { locale: ptBR }) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAdmin(u)}
                      disabled={pendingId === u.id}
                      className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors disabled:opacity-50 ${
                        u.is_super_admin
                          ? 'bg-violet-950/60 text-violet-300 border-violet-800/50 hover:bg-violet-900/60'
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                      title={u.is_super_admin ? 'Revogar super admin' : 'Conceder super admin'}
                    >
                      {u.is_super_admin
                        ? <><ShieldCheck className="w-3.5 h-3.5" /> Sim</>
                        : <><ShieldOff className="w-3.5 h-3.5" /> Não</>}
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-600 text-sm">Nenhum usuário encontrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
