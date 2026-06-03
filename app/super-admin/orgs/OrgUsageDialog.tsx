'use client'

import { useEffect, useState } from 'react'
import { getOrgUsage, type OrgUsage, type SuperAdminOrg } from '@/actions/super-admin'
import { X, Loader2 } from 'lucide-react'

function UsageBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const pct = limit && limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const over = limit != null && used > limit
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-400">{label}</span>
        <span className={`tabular-nums ${over ? 'text-red-400' : 'text-slate-300'}`}>
          {used.toLocaleString('pt-BR')}{limit != null ? ` / ${limit.toLocaleString('pt-BR')}` : ''}
        </span>
      </div>
      {limit != null && (
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <div className={`h-full ${over ? 'bg-red-500' : 'bg-violet-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

export default function OrgUsageDialog({ org, onClose }: { org: SuperAdminOrg; onClose: () => void }) {
  const [usage, setUsage] = useState<OrgUsage | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getOrgUsage(org.id).then(u => { if (active) { setUsage(u); setLoading(false) } })
    return () => { active = false }
  }, [org.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#16161a] p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">{org.name}</h3>
            <p className="text-xs text-slate-500 font-mono">{org.slug}</p>
          </div>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : !usage ? (
          <p className="text-sm text-slate-500 py-8 text-center">Não foi possível carregar o uso desta organização.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300 capitalize">Plano: {usage.plan}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">{usage.status}</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-500">{usage.period}</span>
            </div>

            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wide">Uso no período</h4>
              <UsageBar label="Leads (total)"      used={usage.usage.leads_total}    limit={usage.limits.leads} />
              <UsageBar label="WhatsApp (mês)"      used={usage.usage.whatsapp_month}  limit={usage.limits.whatsapp_monthly} />
              <UsageBar label="E-mails (mês)"       used={usage.usage.email_month}     limit={usage.limits.email_monthly} />
              <UsageBar label="Usuários"            used={usage.usage.members}         limit={usage.limits.users} />
              <div className="grid grid-cols-2 gap-3 pt-1">
                <Stat label="Leads no mês"   value={usage.usage.leads_month} />
                <Stat label="Tarefas abertas" value={usage.usage.tasks_open} />
              </div>
            </section>

            <section className="space-y-3">
              <h4 className="text-xs font-semibold text-white uppercase tracking-wide">Créditos de IA</h4>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Incluídos"  value={usage.ai_credits.included} />
                <Stat label="Comprados"  value={usage.ai_credits.purchased} />
                <Stat label="Usados"     value={usage.ai_credits.used} />
                <Stat label="Restantes"  value={usage.ai_credits.remaining} accent={usage.ai_credits.remaining <= 0 ? 'red' : 'emerald'} />
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: 'red' | 'emerald' }) {
  const color = accent === 'red' ? 'text-red-400' : accent === 'emerald' ? 'text-emerald-400' : 'text-white'
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-3">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value.toLocaleString('pt-BR')}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
    </div>
  )
}
