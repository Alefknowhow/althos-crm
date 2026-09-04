'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateActionCostCatalog, applyRecommendedCreditsCost, updatePricingSettings, applyPlanCredits,
  type AiActionCost, type AiCreditPricingSettings, type PlanCreditProposal,
} from '@/actions/ai-credit-pricing'
import { Pencil, Check, X, Wand2 } from 'lucide-react'

function fmtUsdCents(v: number) {
  return `US$ ${(v / 100).toFixed(5)}`
}
function fmtBrlCents(v: number | null) {
  if (v == null) return '—'
  return (v / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })
}
function fmtBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PricingTab({
  catalog,
  settings,
  planProposal,
}: {
  catalog: AiActionCost[]
  settings: AiCreditPricingSettings | null
  planProposal: PlanCreditProposal[]
}) {
  const router = useRouter()
  const [editingKey, setEditingKey] = useState<string | null>(null)

  function refresh() { router.refresh() }

  return (
    <div className="space-y-8">
      {/* ── Configuração de preço do crédito ── */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Preço do crédito de IA</h2>
        <PricingSettingsCard settings={settings} onSaved={refresh} />
      </section>

      {/* ── Catálogo de custo por ação ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Custo real por ação</h2>
          <p className="text-xs text-slate-500 mt-1">Tokens médios estimados × preço do modelo. `Cobrado` é o valor AO VIVO usado na cobrança (editar aqui muda a cobrança imediatamente, sem deploy).</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5">Ação</th>
                  <th className="text-left font-medium px-3 py-2.5">Modelo</th>
                  <th className="text-right font-medium px-3 py-2.5">Tokens (in/out)</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo real</th>
                  <th className="text-right font-medium px-3 py-2.5">Cobrado</th>
                  <th className="text-right font-medium px-3 py-2.5">Recomendado</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {catalog.map(row => (
                  <CatalogRow
                    key={row.action_key}
                    row={row}
                    editing={editingKey === row.action_key}
                    onEdit={() => setEditingKey(row.action_key)}
                    onCancel={() => setEditingKey(null)}
                    onSaved={() => { setEditingKey(null); refresh() }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Proposta por plano ── */}
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-white">Créditos por plano</h2>
          <p className="text-xs text-slate-500 mt-1">Base atual: créditos já vendidos hoje (300/1200/3000). Custo real e valor de venda equivalente calculados com o preço de crédito acima. Nada muda pra assinantes até você clicar em "Aplicar".</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5">Plano</th>
                  <th className="text-right font-medium px-3 py-2.5">Preço/mês</th>
                  <th className="text-right font-medium px-3 py-2.5">Créditos/mês</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo real (Althos)</th>
                  <th className="text-right font-medium px-3 py-2.5">Valor de venda equiv.</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {planProposal.map(p => (
                  <PlanRow key={p.planId} plan={p} onSaved={refresh} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  )
}

function PricingSettingsCard({ settings, onSaved }: { settings: AiCreditPricingSettings | null; onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const [fx, setFx] = useState(String(settings?.usd_to_brl_rate ?? 5.4))
  const [margin, setMargin] = useState(String(settings?.margin_pct ?? 25))

  function save() {
    startTransition(async () => {
      await updatePricingSettings({ usd_to_brl_rate: Number(fx), margin_pct: Number(margin) })
      onSaved()
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 grid gap-4 sm:grid-cols-4">
      <label className="block">
        <span className="text-[11px] text-slate-500">Câmbio USD→BRL</span>
        <input value={fx} onChange={e => setFx(e.target.value)} type="number" step="0.01"
          className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none" />
      </label>
      <label className="block">
        <span className="text-[11px] text-slate-500">Margem de lucro (%)</span>
        <input value={margin} onChange={e => setMargin(e.target.value)} type="number" step="1"
          className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none" />
      </label>
      <div>
        <span className="text-[11px] text-slate-500 block">Custo do crédito</span>
        <p className="text-lg font-semibold text-white tabular-nums mt-1">{fmtBrlCents(settings?.credit_cost_brl_cents ?? null)}</p>
      </div>
      <div>
        <span className="text-[11px] text-slate-500 block">Preço de venda (+{settings?.margin_pct ?? 25}%)</span>
        <p className="text-lg font-semibold text-emerald-400 tabular-nums mt-1">{fmtBrlCents(settings?.credit_price_brl_cents ?? null)}</p>
      </div>
      <div className="sm:col-span-4">
        <button
          onClick={save}
          disabled={pending}
          className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          Salvar e recalcular
        </button>
        <span className="ml-3 text-[11px] text-slate-500">Ancorado em: {settings?.anchor_action_key || 'ai_attendant_reply'} (custo dessa ação = 1 crédito)</span>
      </div>
    </div>
  )
}

function CatalogRow({ row, editing, onEdit, onCancel, onSaved }: {
  row: AiActionCost
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  onSaved: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [inputTokens, setInputTokens] = useState(String(row.avg_input_tokens))
  const [outputTokens, setOutputTokens] = useState(String(row.avg_output_tokens))
  const [creditsCost, setCreditsCost] = useState(String(row.credits_cost))
  const [costUsdCents, setCostUsdCents] = useState(String(row.avg_cost_usd_cents))

  function save() {
    startTransition(async () => {
      await updateActionCostCatalog(row.action_key, {
        avg_input_tokens: Number(inputTokens),
        avg_output_tokens: Number(outputTokens),
        credits_cost: Number(creditsCost),
        avg_cost_usd_cents: Number(costUsdCents),
      })
      onSaved()
    })
  }

  function applyRecommended() {
    startTransition(async () => {
      await applyRecommendedCreditsCost(row.action_key)
      onSaved()
    })
  }

  const mismatch = row.recommended_credits_cost != null && row.recommended_credits_cost !== row.credits_cost

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/5">
      <td className="px-5 py-2.5">
        <span className="font-medium text-white">{row.label}</span>
        {row.notes && <p className="text-[11px] text-slate-500 mt-0.5 max-w-xs">{row.notes}</p>}
      </td>
      <td className="px-3 py-2.5 text-slate-400">{row.typical_model}</td>
      <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">
        {editing ? (
          <div className="flex gap-1 justify-end">
            <input value={inputTokens} onChange={e => setInputTokens(e.target.value)} type="number" className="w-16 rounded border border-white/10 bg-[#0f0f11] px-1 py-0.5 text-xs text-white" />
            /
            <input value={outputTokens} onChange={e => setOutputTokens(e.target.value)} type="number" className="w-16 rounded border border-white/10 bg-[#0f0f11] px-1 py-0.5 text-xs text-white" />
          </div>
        ) : `${row.avg_input_tokens} / ${row.avg_output_tokens}`}
      </td>
      <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">
        {editing ? (
          <input value={costUsdCents} onChange={e => setCostUsdCents(e.target.value)} type="number" step="0.00001" className="w-20 rounded border border-white/10 bg-[#0f0f11] px-1 py-0.5 text-xs text-white text-right" />
        ) : fmtUsdCents(row.avg_cost_usd_cents)}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {editing ? (
          <input value={creditsCost} onChange={e => setCreditsCost(e.target.value)} type="number" className="w-14 rounded border border-white/10 bg-[#0f0f11] px-1 py-0.5 text-xs text-white text-right" />
        ) : (
          <span className="text-white font-medium">{row.credits_cost}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {row.recommended_credits_cost != null ? (
          <span className={mismatch ? 'text-amber-400 font-medium' : 'text-slate-500'}>{row.recommended_credits_cost}</span>
        ) : '—'}
      </td>
      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button onClick={save} disabled={pending} className="rounded-md p-1.5 text-emerald-400 hover:bg-white/10"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={onCancel} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <>
              {mismatch && (
                <button onClick={applyRecommended} disabled={pending} title="Aplicar valor recomendado" className="rounded-md p-1.5 text-amber-400 hover:bg-white/10">
                  <Wand2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={onEdit} className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /></button>
            </>
          )}
        </div>
      </td>
    </tr>
  )
}

function PlanRow({ plan, onSaved }: { plan: PlanCreditProposal; onSaved: () => void }) {
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [credits, setCredits] = useState(String(plan.currentCreditsMonthly))

  function apply() {
    startTransition(async () => {
      const res = await applyPlanCredits(plan.planId, Number(credits))
      if (res.ok) { setEditing(false); onSaved() } else alert(res.error)
    })
  }

  return (
    <tr className="border-b border-white/5 last:border-0 hover:bg-white/5">
      <td className="px-5 py-2.5 font-medium text-white capitalize">{plan.planName}</td>
      <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmtBrl(plan.priceMonthlyCents)}</td>
      <td className="px-3 py-2.5 text-right tabular-nums">
        {editing ? (
          <input value={credits} onChange={e => setCredits(e.target.value)} type="number" className="w-24 rounded border border-white/10 bg-[#0f0f11] px-1 py-0.5 text-xs text-white text-right" />
        ) : (
          <span className="text-white">{plan.currentCreditsMonthly.toLocaleString('pt-BR')}</span>
        )}
      </td>
      <td className="px-3 py-2.5 text-right text-slate-400 tabular-nums">{fmtBrl(plan.costAtCurrentCreditsBrlCents)}</td>
      <td className="px-3 py-2.5 text-right text-emerald-400 tabular-nums">{fmtBrl(plan.saleValueAtCurrentCreditsBrlCents)}</td>
      <td className="px-5 py-2.5">
        <div className="flex items-center justify-end gap-1">
          {editing ? (
            <>
              <button onClick={apply} disabled={pending} className="rounded-md p-1.5 text-emerald-400 hover:bg-white/10"><Check className="w-3.5 h-3.5" /></button>
              <button onClick={() => setEditing(false)} className="rounded-md p-1.5 text-slate-400 hover:bg-white/10"><X className="w-3.5 h-3.5" /></button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/10"><Pencil className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </td>
    </tr>
  )
}
