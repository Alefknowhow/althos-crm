'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import {
  deletePlatformSubscription,
  type PlatformSubscription, type PlatformCostSummary,
} from '@/actions/platform-subscriptions'
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, ExternalLink, Wallet, AlertTriangle, CheckCircle2, ServerCog } from 'lucide-react'
import { SubscriptionForm, VENDOR_META } from './PlataformaSubscriptionForm'
import { UsageLogPanel } from './PlataformaUsageLogPanel'

const STATUS_META: Record<PlatformSubscription['status'], { label: string; className: string }> = {
  ativo: { label: 'Ativo', className: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/40' },
  trial: { label: 'Trial', className: 'bg-sky-950/60 text-sky-300 border-sky-800/40' },
  pausado: { label: 'Pausado', className: 'bg-amber-950/60 text-amber-300 border-amber-800/40' },
  cancelado: { label: 'Cancelado', className: 'bg-slate-800/60 text-slate-400 border-white/10' },
}

const CYCLE_LABEL: Record<PlatformSubscription['billing_cycle'], string> = {
  mensal: 'Mensal',
  anual: 'Anual',
  uso: 'Por uso',
}

function fmtUsd(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}
function fmtBrl(cents: number | null) {
  if (cents == null) return '—'
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR')
}
function vendorLabel(s: Pick<PlatformSubscription, 'vendor' | 'vendor_label'>) {
  return s.vendor === 'outro' ? (s.vendor_label || 'Outro') : VENDOR_META[s.vendor].label
}

export default function PlataformaClient({
  initialSubscriptions,
  initialSummary,
}: {
  initialSubscriptions: PlatformSubscription[]
  initialSummary: PlatformCostSummary
}) {
  const router = useRouter()
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions)
  const [summary] = useState(initialSummary)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlatformSubscription | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function refresh() {
    router.refresh()
  }

  function openCreate() {
    setEditing(null)
    setShowForm(true)
  }
  function openEdit(s: PlatformSubscription) {
    setEditing(s)
    setShowForm(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta assinatura? Os registros de consumo vinculados também perdem a referência.')) return
    const res = await deletePlatformSubscription(id)
    if (res.ok) {
      setSubscriptions(prev => prev.filter(s => s.id !== id))
      refresh()
    } else alert(res.error)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="space-y-6">
      {/* ── KPIs ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Wallet} label="Custo fixo mensal (USD)" value={fmtUsd(summary.monthlyFixedUsdCents)} />
        <KpiCard icon={Wallet} label="Custo fixo mensal (BRL)" value={fmtBrl(summary.monthlyFixedBrlCents)} />
        <KpiCard icon={ServerCog} label="Assinaturas ativas" value={String(summary.activeCount)} />
        <KpiCard
          icon={summary.overdueCount > 0 ? AlertTriangle : summary.dueSoonCount > 0 ? AlertTriangle : CheckCircle2}
          label="Vencendo (7d) / atrasadas"
          value={`${summary.dueSoonCount} / ${summary.overdueCount}`}
          warn={summary.overdueCount > 0}
        />
      </div>

      {/* ── Ações ── */}
      {!showForm && (
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500"
        >
          <Plus className="w-3.5 h-3.5" /> Nova assinatura
        </button>
      )}

      {showForm && (
        <SubscriptionForm
          editing={editing}
          onDone={(saved) => {
            setShowForm(false)
            setEditing(null)
            if (editing) {
              setSubscriptions(prev => prev.map(s => s.id === saved.id ? saved : s))
            } else {
              setSubscriptions(prev => [...prev, saved])
            }
            refresh()
          }}
          onCancel={() => { setShowForm(false); setEditing(null) }}
        />
      )}

      {/* ── Tabela ── */}
      {subscriptions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/10 bg-white/5 p-10 text-center">
          <ServerCog className="w-7 h-7 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400">Nenhuma assinatura cadastrada ainda.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500 border-b border-white/10">
                  <th className="text-left font-medium px-5 py-2.5 w-6"></th>
                  <th className="text-left font-medium px-3 py-2.5">Provedor</th>
                  <th className="text-left font-medium px-3 py-2.5">Plano</th>
                  <th className="text-left font-medium px-3 py-2.5">Status</th>
                  <th className="text-left font-medium px-3 py-2.5">Ciclo</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo USD</th>
                  <th className="text-right font-medium px-3 py-2.5">Custo BRL</th>
                  <th className="text-left font-medium px-3 py-2.5">Vencimento</th>
                  <th className="text-right font-medium px-5 py-2.5">Ações</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map(s => {
                  const isOverdue = !!s.due_date && new Date(`${s.due_date}T00:00:00`) < today && (s.status === 'ativo' || s.status === 'trial')
                  const isExpanded = expandedId === s.id
                  return (
                    <Fragment key={s.id}>
                      <tr className="border-b border-white/5 last:border-0 hover:bg-white/5">
                        <td className="px-5 py-2.5">
                          <button onClick={() => setExpandedId(isExpanded ? null : s.id)} className="text-slate-500 hover:text-white">
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-medium text-white">{vendorLabel(s)}</span>
                          {s.external_url && (
                            <a href={s.external_url} target="_blank" rel="noreferrer" className="ml-1.5 inline-flex text-slate-500 hover:text-violet-400">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-slate-300">{s.plan_name}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${STATUS_META[s.status].className}`}>
                            {STATUS_META[s.status].label}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{CYCLE_LABEL[s.billing_cycle]}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{fmtUsd(s.cost_usd_cents)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums">{fmtBrl(s.cost_brl_cents)}</td>
                        <td className={`px-3 py-2.5 tabular-nums ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                          {fmtDate(s.due_date)}
                          {isOverdue && <AlertTriangle className="w-3 h-3 inline ml-1 -mt-0.5" />}
                        </td>
                        <td className="px-5 py-2.5">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => openEdit(s)} className="rounded-md p-1.5 text-slate-400 hover:text-white hover:bg-white/10" title="Editar">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="rounded-md p-1.5 text-slate-400 hover:text-red-400 hover:bg-white/10" title="Excluir">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-white/5 bg-black/20">
                          <td colSpan={9} className="px-5 py-4">
                            <UsageLogPanel subscription={s} />
                            {s.notes && (
                              <p className="mt-3 text-xs text-slate-500 whitespace-pre-wrap">Obs.: {s.notes}</p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
                              <span>Início: {fmtDate(s.started_at)}</span>
                              <span>Última renovação: {fmtDate(s.renewed_at)}</span>
                              <span>Renovação automática: {s.auto_renew ? 'Sim' : 'Não'}</span>
                              {s.payment_method && <span>Pagamento: {s.payment_method}</span>}
                              {s.fx_rate_used && <span>Câmbio usado: {s.fx_rate_used}</span>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({ icon: Icon, label, value, warn }: { icon: any; label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warn ? 'border-red-800/40 bg-red-950/20' : 'border-white/10 bg-white/5'}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${warn ? 'text-red-400' : 'text-slate-500'}`} />
        <span className="text-[11px] uppercase tracking-wide text-slate-500">{label}</span>
      </div>
      <p className={`text-xl font-semibold tabular-nums ${warn ? 'text-red-300' : 'text-white'}`}>{value}</p>
    </div>
  )
}

