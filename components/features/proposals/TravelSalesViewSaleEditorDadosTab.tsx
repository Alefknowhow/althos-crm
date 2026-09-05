import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { getContatoTravelerInfo, type TravelSaleRow } from '@/actions/travel-sales'
import VoucherUploadWithOcr from '@/components/features/reservas/VoucherUploadWithOcr'
import { CheckCircle2, ExternalLink, Users, Plus, Trash2 } from 'lucide-react'
import {
  Field, MoneyInput, RetainedCommissionField, OperatorInput, TravelerNameAutocomplete,
  SERVICE_LABELS, PAYMENT_METHODS, INCLUDED_ITEMS, FOCUS_RING,
  type LeadOption, type Voucher,
} from './TravelSalesViewShared'

// Conteúdo da aba "Dados da Reserva" do editor de venda — extraído de
// TravelSalesViewSaleEditor.tsx. Pura movimentação de JSX.
export default function TravelSalesViewSaleEditorDadosTab({
  orgSlug, s, set, services, included, toggleIncluded, travelers, leads, operatorOptions,
  onExtracted,
}: {
  orgSlug: string
  s: TravelSaleRow
  set: (k: keyof TravelSaleRow, v: any) => void
  services: string[]
  included: string[]
  toggleIncluded: (key: string) => void
  travelers: { name?: string; birth_date?: string; cpf?: string }[]
  leads: LeadOption[]
  operatorOptions: string[]
  onExtracted: (args: { voucher: Voucher; extracted: import('@/lib/ai/document-extract').ExtractedTravelDocument | null }) => void
}) {
  return (
    <TabsContent value="dados" className="space-y-4 pt-4">
      <div className="flex justify-end">
        <VoucherUploadWithOcr orgSlug={orgSlug} label="Add voucher" onExtracted={onExtracted} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lado esquerdo */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Cliente">
              {s.contato_id ? (
                <div className="h-9 flex items-center px-3 rounded-md border bg-muted/40 text-sm justify-between gap-2">
                  <span className="truncate">{s.client_name || 'Cliente'}</span>
                  <Link href={`/app/${orgSlug}/contatos/${s.contato_id}`} className="shrink-0 text-primary hover:underline text-xs inline-flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Abrir
                  </Link>
                </div>
              ) : (
                <Input value={s.client_name || ''} onChange={e => set('client_name', e.target.value)} />
              )}
            </Field>
            <Field label="Destino"><Input value={s.destination || ''} onChange={e => set('destination', e.target.value)} /></Field>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <Field label="Data de ida"><Input type="date" value={s.departure_date || ''} onChange={e => set('departure_date', e.target.value)} /></Field>
            <Field label="Data de volta"><Input type="date" value={s.return_date || ''} onChange={e => set('return_date', e.target.value)} /></Field>
          </div>

          <Field label="Itens inclusos na reserva">
            <div className="flex flex-wrap gap-1.5">
              {INCLUDED_ITEMS.map(item => {
                const active = included.includes(item.key)
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => toggleIncluded(item.key)}
                    className={cn(
                      'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg border text-xs font-medium transition-colors',
                      FOCUS_RING,
                      active
                        ? 'bg-success/15 text-success border-success/30'
                        : 'bg-background hover:bg-muted text-muted-foreground border-border',
                    )}
                  >
                    {active && <CheckCircle2 className="w-3.5 h-3.5" />}
                    {item.label}
                  </button>
                )
              })}
            </div>
          </Field>

          {services.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {services.map(k => <Badge key={k} variant="secondary">{SERVICE_LABELS[k] || k}</Badge>)}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2.5">
            <Field label="Operadora">
              <OperatorInput value={s.operator || ''} onChange={v => set('operator', v)} options={operatorOptions} />
            </Field>
            <Field label="Localizador"><Input value={s.package_locator || ''} onChange={e => set('package_locator', e.target.value)} placeholder="Ex.: PKG-12345" /></Field>
            <Field label="Forma de pagamento">
              <div className="flex flex-wrap gap-1.5 pt-1.5">
                {PAYMENT_METHODS.map(m => {
                  const selectedMethods = (s.payment_method || '').split(',').map((x: string) => x.trim()).filter(Boolean)
                  const active = selectedMethods.includes(m)
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        const next = active ? selectedMethods.filter((x: string) => x !== m) : [...selectedMethods, m]
                        set('payment_method', next.length ? next.join(', ') : null)
                      }}
                      className={cn(
                        'px-2 h-8 rounded-lg border text-[11px] font-medium transition-colors',
                        FOCUS_RING,
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted text-muted-foreground border-border',
                      )}
                    >
                      {m}
                    </button>
                  )
                })}
              </div>
            </Field>
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
            <p className="text-[11px] font-semibold text-primary uppercase tracking-wide mb-2">Valores</p>
            <div className="grid grid-cols-3 gap-2.5">
              <Field label="Valor total"><MoneyInput value={s.total_cents || 0} onChange={c => set('total_cents', c)} /></Field>
              <Field label="Comissão">
                <MoneyInput
                  value={s.commission_cents || 0}
                  onChange={c => {
                    set('commission_cents', c)
                    if (s.retained_commission_cents != null && s.retained_commission_cents > c) {
                      set('retained_commission_cents', c > 0 ? c : null)
                    }
                  }}
                />
              </Field>
              <RetainedCommissionField
                commissionCents={s.commission_cents || 0}
                retainedCents={s.retained_commission_cents}
                onChange={v => set('retained_commission_cents', v)}
              />
            </div>
          </div>
        </div>

        {/* Lado direito */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2.5 lg:min-h-[280px]">
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-primary" />
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Viajantes</p>
          </div>
          <div className="space-y-2">
            {travelers.map((t, i) => (
              <div key={i} className="flex flex-wrap items-end gap-2 rounded-md border bg-background/40 p-2">
                <div className="flex-1 min-w-[180px] space-y-1 relative">
                  <Label className="text-[11px] text-muted-foreground">Nome completo</Label>
                  <TravelerNameAutocomplete
                    leads={leads}
                    value={t.name || ''}
                    onChangeText={v => { const n = [...travelers]; n[i] = { ...n[i], name: v }; set('travelers', n) }}
                    onPickLead={async (leadId) => {
                      const res = await getContatoTravelerInfo(orgSlug, leadId)
                      if (!res.ok) { toast.error(res.error); return }
                      const n = [...travelers]; n[i] = res.data; set('travelers', n)
                    }}
                  />
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Nascimento</Label>
                  <Input type="date" value={t.birth_date || ''}
                    onChange={e => { const n = [...travelers]; n[i] = { ...n[i], birth_date: e.target.value }; set('travelers', n) }} />
                </div>
                <div className="w-32 space-y-1">
                  <Label className="text-[11px] text-muted-foreground">CPF</Label>
                  <Input placeholder="000.000.000-00" inputMode="numeric" value={t.cpf || ''}
                    onChange={e => { const n = [...travelers]; n[i] = { ...n[i], cpf: e.target.value }; set('travelers', n) }} />
                </div>
                <Button type="button" variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => set('travelers', travelers.filter((_, j) => j !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => set('travelers', [...travelers, { name: '', birth_date: '', cpf: '' }])}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar viajante
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Field label="Observações"><Textarea rows={2} value={s.notes || ''} onChange={e => set('notes', e.target.value)} /></Field>
        <Field label="Informações importantes">
          <Textarea rows={2} value={s.important_info || ''} onChange={e => set('important_info', e.target.value)}
            placeholder="Contatos de emergência, como buscar atendimento etc." />
        </Field>
        <Field label="Política de cancelamento">
          <Textarea rows={2} value={s.cancellation_policy || ''} onChange={e => set('cancellation_policy', e.target.value)}
            placeholder="Aparece no voucher/contrato só se preenchido." />
        </Field>
        <Field label="Informações de serviço">
          <Textarea rows={2} value={s.service_info || ''} onChange={e => set('service_info', e.target.value)}
            placeholder="O que está incluso, horários, condições de uso etc." />
        </Field>
      </div>

      {s.tasks_generated_at && (
        <p className="text-xs text-success flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5" /> Tarefas operacionais já geradas para esta venda.
        </p>
      )}
    </TabsContent>
  )
}
