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
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { updateOrgLimits, type SuperAdminOrg } from '@/actions/super-admin'

const PLANS = [
  'free_trial',
  'althos_starter',
  'althos_growth',
  'althos_performance',
  'saas_starter',
  'saas_pro',
  'internal',
]

const STATUSES: Array<{ value: string; label: string }> = [
  { value: 'no_billing', label: 'Sem cobrança' },
  { value: 'trialing',   label: 'Trial' },
  { value: 'active',     label: 'Ativo' },
  { value: 'past_due',   label: 'Atrasado' },
  { value: 'canceled',   label: 'Cancelado' },
]

type Props = {
  org:  SuperAdminOrg
  open: boolean
  onClose: () => void
}

export default function OrgLimitsDialog({ org, open, onClose }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    plan:                   org.plan ?? 'free_trial',
    subscription_status:    org.subscription_status ?? 'no_billing',
    limit_leads:            org.limit_leads?.toString()            ?? '',
    limit_whatsapp_monthly: org.limit_whatsapp_monthly?.toString() ?? '',
    limit_email_monthly:    org.limit_email_monthly?.toString()    ?? '',
    limit_users:            org.limit_users?.toString()            ?? '',
    notes:                  org.notes ?? '',
  })

  function patch(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateOrgLimits(org.id, {
        plan:                   form.plan,
        subscription_status:    form.subscription_status as any,
        limit_leads:            form.limit_leads            ? parseInt(form.limit_leads)            : null,
        limit_whatsapp_monthly: form.limit_whatsapp_monthly ? parseInt(form.limit_whatsapp_monthly) : null,
        limit_email_monthly:    form.limit_email_monthly    ? parseInt(form.limit_email_monthly)    : null,
        limit_users:            form.limit_users            ? parseInt(form.limit_users)            : null,
        notes:                  form.notes || null,
      })
      if (res.ok) {
        toast.success('Limites atualizados')
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
          <DialogTitle className="text-white">Editar Limites — {org.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Plan + Status */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Plano</Label>
              <Select value={form.plan} onValueChange={v => patch('plan', v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLANS.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-400 text-xs">Status</Label>
              <Select value={form.subscription_status} onValueChange={v => patch('subscription_status', v)}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Limits */}
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">Notas internas</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={e => patch('notes', e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder:text-slate-600 resize-none"
              placeholder="Contrato, observações, SLA..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-violet-600 hover:bg-violet-500 text-white"
          >
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
