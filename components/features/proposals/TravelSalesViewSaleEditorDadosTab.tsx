import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { TabsContent } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { type TravelSaleRow } from '@/actions/travel-sales'
import VoucherUploadWithOcr from '@/components/features/reservas/VoucherUploadWithOcr'
import { Check, CheckCircle2, ExternalLink } from 'lucide-react'
import {
  Field, MoneyInput, RetainedCommissionField, OperatorInput,
  SERVICE_LABELS, PAYMENT_METHODS, INCLUDED_ITEMS, FOCUS_RING,
  type Voucher,
} from './TravelSalesViewShared'

// Conteúdo da aba "Dados da Reserva" do editor de venda — extraído de
// TravelSalesViewSaleEditor.tsx. Pura movimentação de JSX.
export default function TravelSalesViewSaleEditorDadosTab({
  orgSlug, s, set, services, included, toggleIncluded, operatorOptions,
  onExtracted,
}: {
  orgSlug: string
  s: TravelSaleRow
  set: (k: keyof TravelSaleRow, v: any) => void
  services: string[]
  included: string[]
  toggleIncluded: (key: string) => void
  operatorOptions: string[]
  onExtracted: (args: { voucher: Voucher; extracted: import('@/lib/ai/document-extract').ExtractedTravelDocument | null }) => void
}) {
  return (
    <TabsContent value="dados" className="space-y-4 pt-4">
      <div className="flex justify-end">
        <VoucherUploadWithOcr orgSlug={orgSlug} label="Add voucher" onExtracted={onExtracted} />
      </div>
      <div className="space-y-4 max-w-3xl">
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

        {/* Itens inclusos — checkbox (não pill colorida): quadrado com check
            azul quando ativo, cinza claro quando não (cores do anexo). */}
        <Field label="Itens incluídos">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {INCLUDED_ITEMS.map(item => {
              const active = included.includes(item.key)
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => toggleIncluded(item.key)}
                  className={cn(
                    'inline-flex items-center gap-2 px-2.5 h-8 rounded-md border text-xs font-medium transition-colors',
                    FOCUS_RING,
                    active
                      ? 'bg-primary/5 border-primary/40 text-foreground'
                      : 'bg-background hover:bg-muted/50 text-muted-foreground border-border',
                  )}
                >
                  <span className={cn(
                    'inline-flex items-center justify-center w-4 h-4 rounded shrink-0 border',
                    active ? 'bg-primary border-primary text-primary-foreground' : 'border-input bg-background',
                  )}>
                    {active && <Check className="w-3 h-3" />}
                  </span>
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
            <Select value={s.payment_method || undefined} onValueChange={v => set('payment_method', v)}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
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
