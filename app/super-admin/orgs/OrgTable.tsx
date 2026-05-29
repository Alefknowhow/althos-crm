'use client'

import { useState, useMemo } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Search, ExternalLink, Settings2, CheckCircle2, Clock } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { impersonateOrganization } from '@/actions/super-admin'
import OrgLimitsDialog from './OrgLimitsDialog'
import type { SuperAdminOrg } from '@/actions/super-admin'

const STATUS_BADGE: Record<string, { label: string; class: string }> = {
  active:     { label: 'Ativo',    class: 'bg-emerald-950 text-emerald-300 border-emerald-800' },
  trialing:   { label: 'Trial',    class: 'bg-amber-950  text-amber-300  border-amber-800' },
  past_due:   { label: 'Atrasado', class: 'bg-red-950    text-red-300    border-red-800' },
  canceled:   { label: 'Cancelado',class: 'bg-slate-800  text-slate-400  border-slate-700' },
  no_billing: { label: 'Free',     class: 'bg-slate-800  text-slate-400  border-slate-700' },
}

const ACCOUNT_BADGE: Record<string, { label: string; class: string }> = {
  althos_managed: { label: 'Althos',   class: 'bg-violet-950 text-violet-300 border-violet-800' },
  self_signup:    { label: 'SaaS',     class: 'bg-sky-950    text-sky-300    border-sky-800' },
  internal:       { label: 'Interno',  class: 'bg-slate-800  text-slate-400  border-slate-700' },
}

type Props = { orgs: SuperAdminOrg[] }

export default function OrgTable({ orgs }: Props) {
  const [query,     setQuery]     = useState('')
  const [editOrg,   setEditOrg]   = useState<SuperAdminOrg | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return orgs.filter(o => {
      const matchQ = !q ||
        o.name.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        (o.notes         || '').toLowerCase().includes(q) ||
        (o.niche         || '').toLowerCase().includes(q) ||
        (o.contact_email || '').toLowerCase().includes(q) ||
        (o.contact_phone || '').toLowerCase().includes(q) ||
        (o.address_city  || '').toLowerCase().includes(q)
      const matchS = statusFilter === 'all' || o.subscription_status === statusFilter
      return matchQ && matchS
    })
  }, [orgs, query, statusFilter])

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <Input
            placeholder="Buscar org…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-slate-600 h-9"
          />
        </div>
        <div className="flex gap-1">
          {['all','active','trialing','no_billing','past_due','canceled'].map(s => (
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
        <span className="text-xs text-slate-600 ml-auto">{filtered.length} org{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              {['Organização', 'Nicho', 'Tipo / Status', 'Plano', 'Leads', 'Usuários', 'Criado em', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(org => {
              const statusMeta  = STATUS_BADGE[org.subscription_status]  ?? { label: org.subscription_status, class: 'bg-slate-800 text-slate-400 border-slate-700' }
              const accountMeta = ACCOUNT_BADGE[org.account_type] ?? { label: org.account_type, class: 'bg-slate-800 text-slate-400 border-slate-700' }
              return (
                <tr key={org.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <p className="font-medium text-white">{org.name}</p>
                      {org.onboarding_completed
                        ? <span title="Cadastro completo"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /></span>
                        : <span title="Cadastro pendente"><Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" /></span>
                      }
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{org.slug}</p>
                  </td>
                  <td className="px-4 py-3">
                    {org.niche
                      ? <span className="text-xs text-slate-300">{org.niche}</span>
                      : <span className="text-xs text-slate-600">—</span>
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit text-[10px] font-bold px-1.5 py-0.5 rounded border ${accountMeta.class}`}>
                        {accountMeta.label}
                      </span>
                      <span className={`inline-flex w-fit text-[10px] font-bold px-1.5 py-0.5 rounded border ${statusMeta.class}`}>
                        {statusMeta.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-slate-300 text-xs font-mono">{org.plan}</span>
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className="text-white">{org.leadCount.toLocaleString('pt-BR')}</span>
                    {org.limit_leads && (
                      <span className="text-slate-600 text-xs"> / {org.limit_leads.toLocaleString('pt-BR')}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-300">
                    {org.memberCount}
                    {org.limit_users && <span className="text-slate-600 text-xs"> / {org.limit_users}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {format(new Date(org.created_at), 'dd/MM/yy', { locale: ptBR })}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditOrg(org)}
                        className="h-7 w-7 p-0 text-slate-500 hover:text-white hover:bg-white/10"
                        title="Editar limites"
                      >
                        <Settings2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => impersonateOrganization(org.id)}
                        className="h-7 px-2.5 text-xs text-violet-400 hover:text-violet-200 hover:bg-violet-950/50"
                        title="Acessar como essa organização"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Acessar
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-slate-600 text-sm">
                  Nenhuma organização encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit dialog */}
      {editOrg && (
        <OrgLimitsDialog
          org={editOrg}
          open={!!editOrg}
          onClose={() => setEditOrg(null)}
        />
      )}
    </>
  )
}
