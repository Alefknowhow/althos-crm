'use client'

/**
 * New/edit subscription form for PlataformaClient. Split out of
 * PlataformaClient.tsx.
 */

import { useState, useTransition } from 'react'
import {
  createPlatformSubscription, updatePlatformSubscription,
  type PlatformSubscription, type PlatformSubscriptionInput, type PlatformVendor,
} from '@/actions/platform-subscriptions'
import { Plus, X } from 'lucide-react'

export const VENDOR_META: Record<PlatformVendor, { label: string; hint: string }> = {
  supabase: { label: 'Supabase', hint: 'Ex.: Free, Pro (~US$25/mês), Team' },
  vercel: { label: 'Vercel', hint: 'Ex.: Hobby, Pro (~US$20/mês/membro), Enterprise' },
  resend: { label: 'Resend', hint: 'Ex.: Free, Pro (baseado em volume de e-mails)' },
  inngest: { label: 'Inngest', hint: 'Ex.: Free, Basic, Pro (baseado em execuções)' },
  cloudflare: { label: 'Cloudflare', hint: 'Ex.: Free, Pro' },
  anthropic: { label: 'Claude (Anthropic)', hint: 'Pay-as-you-go — cobrado por tokens de entrada/saída' },
  gemini: { label: 'Gemini (Google)', hint: 'Pay-as-you-go — cobrado por tokens de entrada/saída' },
  outro: { label: 'Outro', hint: '' },
}

export function Field({
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

export function SelectField({
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

export function SubscriptionForm({
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
