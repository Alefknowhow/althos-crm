'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Search, ExternalLink, Settings2, ShieldCheck, ShieldOff,
  Building2, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  impersonateOrganization,
  setUserSuperAdmin,
  type AdminAccountRow,
} from '@/actions/super-admin'
import AccountPlanDialog, { type PlanOption } from './AccountPlanDialog'

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active:     { label: 'Ativo',     class: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  trialing:   { label: 'Trial',     class: 'bg-amber-950  text-amber-300  border-amber-800' },
  past_due:   { label: 'Atrasado',  class: 'bg-red-950    text-red-300    border-red-800' },
  canceled:   { label: 'Cancelado', class: 'bg-slate-800  text-slate-400  border-slate-700' },
  no_billing: { label: 'Free',      class: 'bg-slate-800  text-slate-400  border-slate-700' },
}

function fmtLimit(n: number | null): string {
  if (n == null || n < 0) return '∞'
  return n.toLocaleString('pt-BR')
}

type Props = { accounts: AdminAccountRow[]; plans: PlanOption[] }

export default function AccountsTable({ accounts, plans }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [editAccount, setEditAccount] = useState<AdminAccountRow | null>(null)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const planName = useMemo(() => {
    const m = new Map<string, string>()
    for (const p of plans) m.set(p.id, p.name)
    return m
  }, [plans])

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return accounts.filter(a => {
      const matchQ = !q ||
        a.account_name.toLowerCase().includes(q) ||
        (a.owner_email || '').toLowerCase().includes(q) ||
        (a.owner_name || '').toLowerCase().includes(q) ||
        a.orgs.some(o => o.name.toLowerCase().includes(q))
      const matchS = statusFilter === 'all' || a.subscription_status === statusFilter
      return matchQ && matchS
    })
  }, [accounts, query, statusFilter])

  function toggleAdmin(a: AdminAccountRow) {
    if (!a.owner_user_id) return
    const next = !a.owner_is_super_admin
    if (next && !confirm(`Conceder acesso de SUPER ADMIN a ${a.owner_email}? Isso dá acesso total à plataforma.`)) return
    if (!next && !confirm(`Remover acesso de super admin de ${a.owner_email}?`)) return
    setError(null)
    setPendingId(a.account_id)
    startTransition(async () => {
      const res = await setUserSuperAdmin(a.owner_user_id!, next)
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
            placeholder="Buscar por conta, dono ou org…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 h-9 rounded-md bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-600 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1">
          {['all', 'active', 'trialing', 'no_billing', 'past_due', 'canceled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                statusFilter === s
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            >
              {s === 'all' ? 'Todos' : (STATUS_BADGE[s]?.label ?? s)}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} conta{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {error && <p className="mb-3 text-xs text-red-400">{error}</p>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03]">
                {['Conta / Dono', 'Plano', 'Status', 'Leads', 'Usuários', 'Créditos IA', 'Orgs', 'Super Admin', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => {
                const statusMeta = STATUS_BADGE[a.subscription_status] ?? { label: a.subscription_status, class: 'bg-slate-800 text-slate-400 border-slate-700' }
                const primaryOrg = a.orgs[0]
                return (
                  <tr key={a.account_id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-white font-medium">{a.account_name}</p>
                      <p className="text-xs text-slate-500">{a.owner_name || a.owner_email || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-slate-200 text-xs font-medium">{planName.get(a.plan) ?? a.plan}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex w-fit text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusMeta.class}`}>
                        {statusMeta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="text-white">{a.lead_count.toLocaleString('pt-BR')}</span>
                      <span className="text-slate-600 text-xs"> / {fmtLimit(a.limit_leads)}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      {a.member_count}
                      <span className="text-slate-600 text-xs"> / {fmtLimit(a.limit_users)}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      <span className="inline-flex items-center gap-1 text-fuchsia-300 text-xs">
                        <Sparkles className="w-3 h-3" />
                        {a.ai_credits_used.toLocaleString('pt-BR')} / {a.ai_credits_included.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-300">
                      <span className="inline-flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-500" /> {a.org_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => toggleAdmin(a)}
                        disabled={pendingId === a.account_id || !a.owner_user_id}
                        className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium border transition-colors disabled:opacity-40 ${
                          a.owner_is_super_admin
                            ? 'bg-violet-950/60 text-violet-300 border-violet-800/50 hover:bg-violet-900/60'
                            : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                        }`}
                        title={a.owner_is_super_admin ? 'Revogar super admin' : 'Conceder super admin'}
                      >
                        {a.owner_is_super_admin
                          ? <><ShieldCheck className="w-3.5 h-3.5" /> Sim</>
                          : <><ShieldOff className="w-3.5 h-3.5" /> Não</>}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditAccount(a)}
                          className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-white/10"
                          title="Editar plano e limites"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </Button>
                        {primaryOrg && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => impersonateOrganization(primaryOrg.id)}
                            className="h-7 px-2.5 text-xs text-violet-400 hover:text-violet-200 hover:bg-violet-950/50"
                            title="Acessar como essa conta"
                          >
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Acessar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-slate-600 text-sm">Nenhuma conta encontrada.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editAccount && (
        <AccountPlanDialog
          account={editAccount}
          plans={plans}
          open={!!editAccount}
          onClose={() => setEditAccount(null)}
        />
      )}
    </>
  )
}
