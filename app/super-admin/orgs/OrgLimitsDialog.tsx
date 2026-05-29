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
import { CheckCircle2, Clock, Mail, Phone, MapPin, Tag } from 'lucide-react'
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
          {/* Onboarding data (read-only) */}
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dados do Cadastro</span>
              {org.onboarding_completed
                ? <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CheckCircle2 className="w-3 h-3" /> Completo</span>
                : <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400"><Clock className="w-3 h-3" /> Pendente</span>
              }
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <Mail className="w-3 h-3 text-slate-500 shrink-0" />
                {org.contact_email
                  ? <span className="text-slate-300 truncate">{org.contact_email}</span>
                  : <span className="text-slate-600">—</span>
                }
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <Phone className="w-3 h-3 text-slate-500 shrink-0" />
                {org.contact_phone
                  ? <span className="text-slate-300">{org.contact_phone}</span>
                  : <span className="text-slate-600">—</span>
                }
              </div>
              <div className="flex items-center gap-1.5 min-w-0 col-span-2">
                <Tag className="w-3 h-3 text-slate-500 shrink-0" />
                {org.niche
                  ? <span className="text-slate-300">{org.niche}</span>
                  : <span className="text-slate-600">Nicho não informado</span>
                }
              </div>
              <div className="flex items-start gap-1.5 min-w-0 col-span-2">
                <MapPin className="w-3 h-3 text-slate-500 shrink-0 mt-0.5" />
                {(org.address_city || org.address_state || org.address_zip)
                  ? (
                    <span className="text-slate-300">
                      {[org.address_city, org.address_state].filter(Boolean).join(' – ')}
                      {org.address_zip ? <span className="text-slate-500"> · {org.address_zip}</span> : null}
                    </span>
                  )
                  : <span className="text-slate-600">Endereço não informado</span>
                }
              </div>
            </div>
          </div>

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
