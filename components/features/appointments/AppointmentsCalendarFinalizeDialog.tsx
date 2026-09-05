import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Check } from 'lucide-react'
import type { CalendarAppointment } from './AppointmentsCalendarShared'

// Diálogo "Finalizar atendimento" (nicho Clínicas) — captura valor/forma de
// pagamento/parcelas antes de avançar pra 'realizado'. Extraído de
// AppointmentsCalendar.tsx. Pura movimentação de JSX.

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX', credito: 'Cartão de Crédito', debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro', boleto: 'Boleto', transferencia: 'Transferência',
}

export type FinalizeForm = { total: string; discount: string; paymentMethod: string; installments: string }

export function AppointmentsCalendarFinalizeDialog({
  finalizeTarget, setFinalizeTarget, finalizeForm, setFinalizeForm, submitFinalize,
}: {
  finalizeTarget: CalendarAppointment | null
  setFinalizeTarget: (a: CalendarAppointment | null) => void
  finalizeForm: FinalizeForm
  setFinalizeForm: React.Dispatch<React.SetStateAction<FinalizeForm>>
  submitFinalize: (e: React.FormEvent) => void
}) {
  return (
    <Dialog open={!!finalizeTarget} onOpenChange={o => !o && setFinalizeTarget(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Finalizar atendimento</DialogTitle>
        </DialogHeader>
        {finalizeTarget && (
          <form onSubmit={submitFinalize} className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {finalizeTarget.guest_name} — deixe em branco pra usar o preço de tabela do procedimento.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Valor cobrado (R$)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={finalizeForm.total}
                  onChange={e => setFinalizeForm(f => ({ ...f, total: e.target.value }))}
                  placeholder="Preço de tabela"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Desconto (R$)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={finalizeForm.discount}
                  onChange={e => setFinalizeForm(f => ({ ...f, discount: e.target.value }))}
                  placeholder="0,00"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Forma de pagamento</Label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
                  value={finalizeForm.paymentMethod}
                  onChange={e => setFinalizeForm(f => ({ ...f, paymentMethod: e.target.value }))}
                >
                  <option value="">(Não informado)</option>
                  {Object.entries(PAYMENT_METHOD_LABEL).map(([k, l]) => (
                    <option key={k} value={k}>{l}</option>
                  ))}
                </select>
              </div>
              {finalizeForm.paymentMethod === 'credito' && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Parcelas</Label>
                  <Input
                    type="number" min={1} max={24} step={1}
                    value={finalizeForm.installments}
                    onChange={e => setFinalizeForm(f => ({ ...f, installments: e.target.value }))}
                    placeholder="1"
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="submit">
                <Check className="w-4 h-4 mr-1" /> Finalizar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
