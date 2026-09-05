'use client'

/**
 * Usage-log panel shown in the expanded row of a subscription in
 * PlataformaClient. Split out of PlataformaClient.tsx.
 */

import { useState, useTransition } from 'react'
import {
  listPlatformUsageLogs, createPlatformUsageLog, deletePlatformUsageLog,
  type PlatformSubscription, type PlatformUsageLog,
} from '@/actions/platform-subscriptions'
import { Plus, Trash2 } from 'lucide-react'
import { Field } from './PlataformaSubscriptionForm'

function fmtUsd(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}

export function UsageLogPanel({ subscription }: { subscription: PlatformSubscription }) {
  const [logs, setLogs] = useState<PlatformUsageLog[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [pending, startTransition] = useTransition()

  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [metricLabel, setMetricLabel] = useState('')
  const [metricValue, setMetricValue] = useState('')
  const [costUsd, setCostUsd] = useState('')

  async function load() {
    if (logs !== null) return
    setLoading(true)
    const data = await listPlatformUsageLogs(subscription.id)
    setLogs(data)
    setLoading(false)
  }

  // Carrega assim que expandido — chamado pelo pai via renderização condicional.
  if (logs === null && !loading) load()

  function submitUsage() {
    if (!metricLabel.trim() || !periodStart || !periodEnd) return
    startTransition(async () => {
      const res = await createPlatformUsageLog({
        subscription_id: subscription.id,
        vendor: subscription.vendor,
        period_start: periodStart,
        period_end: periodEnd,
        metric_label: metricLabel,
        metric_value: Number(metricValue) || 0,
        cost_usd_cents: costUsd ? Math.round(Number(costUsd) * 100) : null,
      })
      if (res.ok) {
        setLogs(prev => [{
          id: crypto.randomUUID(),
          subscription_id: subscription.id,
          vendor: subscription.vendor,
          period_start: periodStart,
          period_end: periodEnd,
          metric_label: metricLabel,
          metric_value: Number(metricValue) || 0,
          cost_usd_cents: costUsd ? Math.round(Number(costUsd) * 100) : null,
          notes: null,
          created_at: new Date().toISOString(),
        }, ...(prev || [])])
        setPeriodStart(''); setPeriodEnd(''); setMetricLabel(''); setMetricValue(''); setCostUsd('')
        setShowForm(false)
      }
    })
  }

  async function handleDeleteLog(id: string) {
    const res = await deletePlatformUsageLog(id)
    if (res.ok) setLogs(prev => (prev || []).filter(l => l.id !== id))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-wide text-slate-500">Consumo registrado</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-violet-400 hover:text-violet-300"
        >
          <Plus className="w-3 h-3" /> Registrar consumo
        </button>
      </div>

      {showForm && (
        <div className="grid gap-2 sm:grid-cols-6 items-end bg-black/20 rounded-lg p-3">
          <Field label="Início" value={periodStart} onChange={setPeriodStart} type="date" />
          <Field label="Fim" value={periodEnd} onChange={setPeriodEnd} type="date" />
          <div className="sm:col-span-2">
            <Field label="Métrica" value={metricLabel} onChange={setMetricLabel} placeholder="Ex.: Tokens de entrada" />
          </div>
          <Field label="Valor" value={metricValue} onChange={setMetricValue} type="number" />
          <Field label="Custo (USD)" value={costUsd} onChange={setCostUsd} type="number" placeholder="opcional" />
          <div className="sm:col-span-6">
            <button
              onClick={submitUsage}
              disabled={pending}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              Salvar
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Carregando...</p>
      ) : logs && logs.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500 border-b border-white/10">
                <th className="text-left font-medium py-1.5 pr-3">Período</th>
                <th className="text-left font-medium py-1.5 pr-3">Métrica</th>
                <th className="text-right font-medium py-1.5 pr-3">Valor</th>
                <th className="text-right font-medium py-1.5 pr-3">Custo (USD)</th>
                <th className="w-6"></th>
              </tr>
            </thead>
            <tbody>
              {logs.map(l => (
                <tr key={l.id} className="border-b border-white/5 last:border-0">
                  <td className="py-1.5 pr-3 text-slate-300">{fmtDate(l.period_start)} – {fmtDate(l.period_end)}</td>
                  <td className="py-1.5 pr-3 text-slate-300">{l.metric_label}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-300 tabular-nums">{l.metric_value.toLocaleString('pt-BR')}</td>
                  <td className="py-1.5 pr-3 text-right text-slate-300 tabular-nums">{fmtUsd(l.cost_usd_cents)}</td>
                  <td className="py-1.5">
                    <button onClick={() => handleDeleteLog(l.id)} className="text-slate-500 hover:text-red-400">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-xs text-slate-500">Nenhum registro de consumo ainda.</p>
      )}
    </div>
  )
}
