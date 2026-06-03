'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createCoupon, setCouponActive, type AdminCoupon } from '@/actions/super-admin'
import { Plus, Power, Ticket, X } from 'lucide-react'

function discountLabel(c: AdminCoupon): string {
  return c.discount_type === 'percent'
    ? `${c.discount_value}%`
    : (c.discount_value / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function CouponManager({
  coupons,
  planNames,
}: {
  coupons: AdminCoupon[]
  planNames: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
        >
          <Plus className="w-3.5 h-3.5" /> Novo cupom
        </button>
      )}

      {showForm && <CouponForm planNames={planNames} onDone={() => { setShowForm(false); router.refresh() }} onCancel={() => setShowForm(false)} />}

      {coupons.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
          <Ticket className="w-7 h-7 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhum cupom criado.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5">Código</th>
                  <th className="text-left font-medium px-3 py-2.5">Desconto</th>
                  <th className="text-left font-medium px-3 py-2.5">Plano</th>
                  <th className="text-right font-medium px-3 py-2.5">Usos</th>
                  <th className="text-left font-medium px-3 py-2.5">Duração</th>
                  <th className="text-left font-medium px-3 py-2.5">Expira</th>
                  <th className="text-right font-medium px-5 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map(c => (
                  <CouponRow key={c.id} coupon={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CouponRow({ coupon: c }: { coupon: AdminCoupon }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function toggle() {
    startTransition(async () => {
      await setCouponActive(c.id, !c.is_active)
      router.refresh()
    })
  }

  const maxLabel = c.max_uses === 0 ? '∞' : c.max_uses

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/5">
      <td className="px-5 py-2.5">
        <span className="font-mono font-semibold text-white">{c.code}</span>
        {c.description && <p className="text-[11px] text-slate-500">{c.description}</p>}
      </td>
      <td className="px-3 py-2.5 text-emerald-400 tabular-nums">{discountLabel(c)}</td>
      <td className="px-3 py-2.5 text-slate-400 capitalize">{c.applies_to_plan ?? 'Todos'}</td>
      <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{c.uses_count}/{maxLabel}</td>
      <td className="px-3 py-2.5 text-slate-400">{c.duration_months} {c.duration_months === 1 ? 'mês' : 'meses'}</td>
      <td className="px-3 py-2.5 text-slate-400">{c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : '—'}</td>
      <td className="px-5 py-2.5 text-right">
        <button
          onClick={toggle}
          disabled={pending}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium disabled:opacity-50 ${
            c.is_active
              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/40'
              : 'bg-slate-800/60 text-slate-400 border border-white/10'
          }`}
        >
          <Power className="w-3 h-3" /> {c.is_active ? 'Ativo' : 'Inativo'}
        </button>
      </td>
    </tr>
  )
}

function CouponForm({
  planNames,
  onDone,
  onCancel,
}: {
  planNames: { id: string; name: string }[]
  onDone: () => void
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [code, setCode]               = useState('')
  const [description, setDescription] = useState('')
  const [discountType, setDiscountType] = useState<'percent' | 'fixed_cents'>('percent')
  const [discountValue, setDiscountValue] = useState('')
  const [appliesToPlan, setAppliesToPlan] = useState('')
  const [maxUses, setMaxUses]         = useState('0')
  const [durationMonths, setDuration] = useState('1')
  const [expiresAt, setExpiresAt]     = useState('')

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await createCoupon({
        code,
        description: description || null,
        discount_type: discountType,
        discount_value: discountValue,
        applies_to_plan: appliesToPlan || null,
        max_uses: maxUses,
        duration_months: durationMonths,
        expires_at: expiresAt || null,
      })
      if (!res.ok) { setError(res.error); return }
      onDone()
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Novo cupom</h3>
        <button onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Código" value={code} onChange={setCode} placeholder="BLACKFRIDAY" mono />
        <Field label="Descrição" value={description} onChange={setDescription} placeholder="Opcional" />

        <label className="block">
          <span className="text-[11px] text-slate-500">Tipo de desconto</span>
          <select
            value={discountType}
            onChange={e => setDiscountType(e.target.value as any)}
            className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
          >
            <option value="percent">Percentual (%)</option>
            <option value="fixed_cents">Valor fixo (centavos)</option>
          </select>
        </label>
        <Field
          label={discountType === 'percent' ? 'Valor (%)' : 'Valor (centavos)'}
          value={discountValue}
          onChange={setDiscountValue}
          type="number"
        />

        <label className="block">
          <span className="text-[11px] text-slate-500">Aplica-se ao plano</span>
          <select
            value={appliesToPlan}
            onChange={e => setAppliesToPlan(e.target.value)}
            className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white capitalize focus:border-violet-500 focus:outline-none"
          >
            <option value="">Todos os planos</option>
            {planNames.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <Field label="Máx. usos (0 = ilimitado)" value={maxUses} onChange={setMaxUses} type="number" />

        <Field label="Duração (meses)" value={durationMonths} onChange={setDuration} type="number" />
        <Field label="Expira em" value={expiresAt} onChange={setExpiresAt} type="date" />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Criar cupom
        </button>
        <button
          onClick={onCancel}
          disabled={pending}
          className="rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/5"
        >
          Cancelar
        </button>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  mono = false,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  mono?: boolean
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none ${mono ? 'font-mono uppercase' : ''}`}
      />
    </label>
  )
}
