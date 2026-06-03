'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePlanPricing, type AdminPlan } from '@/actions/super-admin'
import { Check, Pencil, Users, Sparkles, X } from 'lucide-react'

function brl(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PlanCard({ plan }: { plan: AdminPlan }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [monthly, setMonthly] = useState(String(plan.price_monthly_cents))
  const [annual, setAnnual]   = useState(String(plan.price_annual_cents))
  const [credits, setCredits] = useState(String(plan.ai_credits_monthly))
  const [active, setActive]   = useState(plan.is_active)

  function reset() {
    setMonthly(String(plan.price_monthly_cents))
    setAnnual(String(plan.price_annual_cents))
    setCredits(String(plan.ai_credits_monthly))
    setActive(plan.is_active)
    setError(null)
  }

  function save() {
    setError(null)
    startTransition(async () => {
      const res = await updatePlanPricing(plan.id, {
        price_monthly_cents: monthly,
        price_annual_cents:  annual,
        ai_credits_monthly:  credits,
        is_active:           active,
      })
      if (!res.ok) { setError(res.error); return }
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <div className={`rounded-xl border p-4 flex flex-col gap-3 ${plan.is_active ? 'border-white/10 bg-white/5' : 'border-white/5 bg-white/[0.02] opacity-70'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-white capitalize">{plan.name}</p>
          <p className="text-[11px] text-slate-500 font-mono">{plan.id}</p>
        </div>
        {!editing && (
          <button
            onClick={() => { reset(); setEditing(true) }}
            className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/10"
            aria-label="Editar plano"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2.5">
          <Field label="Mensal (centavos)" value={monthly} onChange={setMonthly} />
          <Field label="Anual (centavos)"  value={annual}  onChange={setAnnual} />
          <Field label="Créditos IA / mês"  value={credits} onChange={setCredits} />
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="accent-violet-600" />
            Plano ativo
          </label>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" /> Salvar
            </button>
            <button
              onClick={() => { setEditing(false); reset() }}
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>
            <p className="text-2xl font-bold text-white tabular-nums">{brl(plan.price_monthly_cents)}</p>
            <p className="text-[11px] text-slate-500">/mês · {brl(plan.price_annual_cents)}/ano</p>
          </div>
          <div className="flex flex-col gap-1.5 text-xs text-slate-400 mt-1">
            <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-fuchsia-400" /> {plan.ai_credits_monthly.toLocaleString('pt-BR')} créditos IA/mês</span>
            <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-emerald-400" /> {plan.active_subscriptions} assinatura{plan.active_subscriptions === 1 ? '' : 's'} ativa{plan.active_subscriptions === 1 ? '' : 's'}</span>
          </div>
          {!plan.is_active && <span className="text-[10px] text-amber-400 font-medium">Inativo</span>}
        </>
      )}
    </div>
  )
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white tabular-nums focus:border-violet-500 focus:outline-none"
      />
    </label>
  )
}
