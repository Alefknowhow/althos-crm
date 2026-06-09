'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Building2, Sparkles } from 'lucide-react'
import { updateAccountPlan, type AdminAccountRow } from '@/actions/super-admin'

export type PlanOption = {
  id:                  string
  name:                string
  max_leads_per_month: number
  max_users:           number
  ai_credits_monthly:  number
}

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'no_billing', label: 'Sem cobrança (Free)' },
  { value: 'trialing',   label: 'Trial' },
  { value: 'active',     label: 'Ativo' },
  { value: 'past_due',   label: 'Atrasado' },
  { value: 'canceled',   label: 'Cancelado' },
]

const CYCLES: Array<{ value: string; label: string }> = [
  { value: 'monthly',   label: 'Mensal' },
  { value: 'semestral', label: 'Semestral' },
  { value: 'annual',    label: 'Anual' },
]

/** -1 (ilimitado no catálogo) → '' (placeholder ∞). */
function catalogToInput(n: number | null | undefined): string {
  if (n == null || n < 0) return ''
  return String(n)
}

type Props = {
  account: AdminAccountRow
  plans:   PlanOption[]
  open:    boolean
  onClose: () => void
}

export default function AccountPlanDialog({ account, plans, open, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    plan:                   account.plan || 'free',
    subscription_status:    account.subscription_status || 'no_billing',
    billing_cycle:          account.billing_cycle || 'monthly',
    limit_leads:            catalogToInput(account.limit_leads),
    limit_users:            catalogToInput(account.limit_users),
    limit_whatsapp_monthly: catalogToInput(account.limit_whatsapp_monthly),
    limit_email_monthly:    catalogToInput(account.limit_email_monthly),
  })

  const selectedPlan = plans.find(p => p.id === form.plan)

  function patch(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  /** Trocar o plano sincroniza limites + créditos a partir do catálogo. */
  function onPlanChange(planId: string) {
    const p = plans.find(pl => pl.id === planId)
    setForm(f => ({
      ...f,
      plan: planId,
      limit_leads: p ? catalogToInput(p.max_leads_per_month) : f.limit_leads,
      limit_users: p ? catalogToInput(p.max_users) : f.limit_users,
    }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateAccountPlan(account.account_id, {
        plan:                   form.plan,
        subscription_status:    form.subscription_status as any,
        billing_cycle:          form.billing_cycle as any,
        limit_leads:            form.limit_leads            ? parseInt(form.limit_leads)            : null,
        limit_users:            form.limit_users            ? parseInt(form.limit_users)            : null,
        limit_whatsapp_monthly: form.limit_whatsapp_monthly ? parseInt(form.limit_whatsapp_monthly) : null,
        limit_email_monthly:    form.limit_email_monthly    ? parseInt(form.limit_email_monthly)    : null,
      })
      if (res.ok) {
        toast.success('Plano e limites atualizados')
        router.refresh()
        onClose()
      } else {
        toast.error(res.error || 'Erro ao salvar')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg bg-[#1a1a1f] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="text-white">Plano &amp; Limites — {account.account_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Owner + scope */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs space-y-1.5">
            <p className="text-slate-300">
              <span className="text-slate-500">Dono:</span> {account.owner_name || account.owner_email || '—'}
            </p>
            <p className="flex items-center gap-1.5 text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              {account.org_count} organizaç{account.org_count === 1 ? 'ão' : 'ões'} · o plano se aplica a todas
            </p>
            {selectedPlan && (
              <p className="flex items-center gap-1.5 text-fuchsia-300">
                <Sparkles className="w-3.5 h-3.5" />
                {selectedPlan.ai_credits_monthly.toLocaleString('pt-BR')} créditos de IA/mês neste plano
              </p>
            )}
          </div>

          {/* Plan + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Plano</Label>
              <Select value={form.plan} onValueChange={onPlanChange}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Status</Label>
              <Select value={form.subscription_status} onValueChange={v => patch('subscription_status', v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Billing cycle */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Ciclo de cobrança</Label>
            <Select value={form.billing_cycle} onValueChange={v => patch('billing_cycle', v)}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CYCLES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Limits */}
          <div>
            <p className="text-[11px] text-slate-500 mb-2">Limites (em branco = ilimitado). Sincronizados ao trocar o plano.</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'limit_leads',            label: 'Limite de Leads' },
                { key: 'limit_users',            label: 'Limite de Usuários' },
                { key: 'limit_whatsapp_monthly', label: 'WhatsApp / mês' },
                { key: 'limit_email_monthly',    label: 'E-mails / mês' },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">{label}</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="∞"
                    value={(form as any)[key]}
                    onChange={e => patch(key, e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder:text-slate-600"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-500 text-white">
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
