'use client'

import { useState, useTransition, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import {
  createPlatformSubscription, updatePlatformSubscription, deletePlatformSubscription,
  listPlatformUsageLogs, createPlatformUsageLog, deletePlatformUsageLog,
  type PlatformSubscription, type PlatformSubscriptionInput, type PlatformCostSummary,
  type PlatformUsageLog, type PlatformVendor,
} from '@/actions/platform-subscriptions'
import { Plus, X, Pencil, Trash2, ChevronDown, ChevronRight, ExternalLink, Wallet, AlertTriangle, CheckCircle2, ServerCog } from 'lucide-react'

const VENDOR_META: Record<PlatformVendor, { label: string; hint: string }> = {
  supabase: { label: 'Supabase', hint: 'Ex.: Free, Pro (~US$25/mês), Team' },
  vercel: { label: 'Vercel', hint: 'Ex.: Hobby, Pro (~US$20/mês/membro), Enterprise' },
  resend: { label: 'Resend', hint: 'Ex.: Free, Pro (baseado em volume de e-mails)' },
  inngest: { label: 'Inngest', hint: 'Ex.: Free, Basic, Pro (baseado em execuções)' },
  cloudflare: { label: 'Cloudflare', hint: 'Ex.: Free, Pro' },
  anthropic: { label: 'Claude (Anthropic)', hint: 'Pay-as-you-go — cobrado por tokens de entrada/saída' },
  gemini: { label: 'Gemini (Google)', hint: 'Pay-as-you-go — cobrado por tokens de entrada/saída' },
  outro: { label: 'Outro', hint: '' },
}

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
  const [summary, setSummary] = useState(initialSummary)
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

function SubscriptionForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: PlatformSubscription | null
  onDone: (saved: PlatformSubscription) => void
  onCancel: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [vendor, setVendor] = useState<PlatformVendor>(editing?.vendor || 'supabase')
  const [vendorLabelInput, setVendorLabelInput] = useState(editing?.vendor_label || '')
  const [planName, setPlanName] = useState(editing?.plan_name || '')
  const [status, setStatus] = useState<PlatformSubscription['status']>(editing?.status || 'ativo')
  const [billingCycle, setBillingCycle] = useState<PlatformSubscription['billing_cycle']>(editing?.billing_cycle || 'mensal')
  const [costUsd, setCostUsd] = useState(editing?.cost_usd_cents != null ? String(editing.cost_usd_cents / 100) : '')
  const [costBrl, setCostBrl] = useState(editing?.cost_brl_cents != null ? String(editing.cost_brl_cents / 100) : '')
  const [fxRate, setFxRate] = useState(editing?.fx_rate_used != null ? String(editing.fx_rate_used) : '')
  const [startedAt, setStartedAt] = useState(editing?.started_at || '')
  const [renewedAt, setRenewedAt] = useState(editing?.renewed_at || '')
  const [dueDate, setDueDate] = useState(editing?.due_date || '')
  const [autoRenew, setAutoRenew] = useState(editing?.auto_renew ?? true)
  const [paymentMethod, setPaymentMethod] = useState(editing?.payment_method || '')
  const [externalUrl, setExternalUrl] = useState(editing?.external_url || '')
  const [notes, setNotes] = useState(editing?.notes || '')

  function applyFxRate() {
    const usd = Number(costUsd)
    const rate = Number(fxRate)
    if (usd > 0 && rate > 0) setCostBrl((usd * rate).toFixed(2))
  }

  function submit() {
    setError(null)
    if (!planName.trim()) { setError('Informe o nome do plano.'); return }
    const input: PlatformSubscriptionInput = {
      vendor,
      vendor_label: vendorLabelInput || null,
      plan_name: planName,
      status,
      billing_cycle: billingCycle,
      cost_usd_cents: costUsd ? Math.round(Number(costUsd) * 100) : null,
      cost_brl_cents: costBrl ? Math.round(Number(costBrl) * 100) : null,
      fx_rate_used: fxRate ? Number(fxRate) : null,
      started_at: startedAt || null,
      renewed_at: renewedAt || null,
      due_date: dueDate || null,
      auto_renew: autoRenew,
      payment_method: paymentMethod || null,
      external_url: externalUrl || null,
      notes: notes || null,
    }
    startTransition(async () => {
      const res = editing
        ? await updatePlatformSubscription(editing.id, input)
        : await createPlatformSubscription(input)
      if (!res.ok) { setError(res.error); return }
      // Server actions não retornam a linha completa — reconstrói localmente
      // pra atualizar a UI sem esperar um refetch.
      onDone({
        id: editing?.id || crypto.randomUUID(),
        ...input,
        vendor_label: input.vendor_label ?? null,
        cost_usd_cents: input.cost_usd_cents ?? null,
        cost_brl_cents: input.cost_brl_cents ?? null,
        fx_rate_used: input.fx_rate_used ?? null,
        started_at: input.started_at ?? null,
        renewed_at: input.renewed_at ?? null,
        due_date: input.due_date ?? null,
        auto_renew: input.auto_renew ?? true,
        payment_method: input.payment_method ?? null,
        external_url: input.external_url ?? null,
        notes: input.notes ?? null,
        created_at: editing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlatformSubscription)
    })
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{editing ? 'Editar assinatura' : 'Nova assinatura'}</h3>
        <button onClick={onCancel} className="rounded-md p-1 text-slate-400 hover:text-white hover:bg-white/10">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <SelectField
          label="Provedor"
          value={vendor}
          onChange={v => setVendor(v as PlatformVendor)}
          options={Object.entries(VENDOR_META).map(([k, m]) => ({ value: k, label: m.label }))}
        />
        {vendor === 'outro' && (
          <Field label="Nome do provedor" value={vendorLabelInput} onChange={setVendorLabelInput} placeholder="Ex.: Twilio" />
        )}
        <Field
          label="Plano"
          value={planName}
          onChange={setPlanName}
          placeholder={VENDOR_META[vendor].hint}
        />

        <SelectField
          label="Status"
          value={status}
          onChange={v => setStatus(v as PlatformSubscription['status'])}
          options={[
            { value: 'ativo', label: 'Ativo' },
            { value: 'trial', label: 'Trial' },
            { value: 'pausado', label: 'Pausado' },
            { value: 'cancelado', label: 'Cancelado' },
          ]}
        />
        <SelectField
          label="Ciclo de cobrança"
          value={billingCycle}
          onChange={v => setBillingCycle(v as PlatformSubscription['billing_cycle'])}
          options={[
            { value: 'mensal', label: 'Mensal' },
            { value: 'anual', label: 'Anual' },
            { value: 'uso', label: 'Por uso (pay-as-you-go)' },
          ]}
        />
        <label className="flex items-center gap-2 pt-5">
          <input type="checkbox" checked={autoRenew} onChange={e => setAutoRenew(e.target.checked)} className="rounded border-white/20 bg-[#0f0f11]" />
          <span className="text-sm text-slate-300">Renovação automática</span>
        </label>

        <Field label="Custo (USD)" value={costUsd} onChange={setCostUsd} type="number" placeholder="0.00" />
        <Field label="Taxa de câmbio (USD→BRL)" value={fxRate} onChange={setFxRate} type="number" placeholder="Ex.: 5.40" />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Field label="Custo (BRL)" value={costBrl} onChange={setCostBrl} type="number" placeholder="0.00" />
          </div>
          <button
            type="button"
            onClick={applyFxRate}
            className="mb-0.5 rounded-md border border-white/10 px-2.5 py-1.5 text-xs text-slate-300 hover:bg-white/5 whitespace-nowrap"
            title="Calcular BRL a partir do USD e da taxa de câmbio"
          >
            Calcular
          </button>
        </div>

        <Field label="Início da assinatura" value={startedAt} onChange={setStartedAt} type="date" />
        <Field label="Última renovação" value={renewedAt} onChange={setRenewedAt} type="date" />
        <Field label="Próximo vencimento" value={dueDate} onChange={setDueDate} type="date" />

        <Field label="Forma de pagamento" value={paymentMethod} onChange={setPaymentMethod} placeholder="Ex.: Cartão final 1234" />
        <div className="sm:col-span-2 lg:col-span-2">
          <Field label="Link do painel de cobrança" value={externalUrl} onChange={setExternalUrl} placeholder="https://..." />
        </div>

        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block">
            <span className="text-[11px] text-slate-500">Observações</span>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
            />
          </label>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={submit}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> {editing ? 'Salvar alterações' : 'Criar assinatura'}
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

function UsageLogPanel({ subscription }: { subscription: PlatformSubscription }) {
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

function Field({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
      />
    </label>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500">{label}</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="mt-0.5 w-full rounded-md border border-white/10 bg-[#0f0f11] px-2 py-1.5 text-sm text-white focus:border-violet-500 focus:outline-none"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
