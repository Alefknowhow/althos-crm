'use client'

import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { cancelTravelSale } from '@/actions/travel-sales'
import { toast } from 'sonner'
import { Ban } from 'lucide-react'

function centsToReais(c: number) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export default function CancelTravelSaleDialog({
  open, onOpenChange, orgSlug, saleId, onCancelled,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orgSlug: string
  saleId: string
  onCancelled: () => void
}) {
  const [valorText, setValorText] = useState('')
  const [operadora, setOperadora] = useState('')
  const [validade, setValidade] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [saving, setSaving] = useState(false)

  function reset() {
    setValorText(''); setOperadora(''); setValidade(''); setObservacoes('')
  }

  async function handleConfirm() {
    const valorCredito = reaisToCents(valorText)
    if (!valorCredito || valorCredito <= 0) { toast.error('Informe o valor do crédito.'); return }
    if (!operadora.trim()) { toast.error('Informe a operadora.'); return }

    setSaving(true)
    const res = await cancelTravelSale(orgSlug, saleId, {
      valorCredito,
      operadora: operadora.trim(),
      validade: validade || null,
      observacoes: observacoes.trim() || null,
    })
    setSaving(false)

    if (!res.ok) { toast.error(res.error); return }
    toast.success('Reserva cancelada e crédito de viagem gerado.')
    reset()
    onOpenChange(false)
    onCancelled()
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Ban className="w-4 h-4 text-destructive" /> Cancelar reserva</DialogTitle>
          <DialogDescription>
            A operadora normalmente retém o valor como crédito para uma venda futura do cliente, em vez de devolver em dinheiro. Informe os dados do crédito gerado.
          </DialogDescription>
        </DialogHeader>

        <div className="py-2 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Valor do crédito <span className="text-destructive">*</span></Label>
              <Input inputMode="decimal" placeholder="R$ 0,00" value={valorText} onChange={e => setValorText(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operadora <span className="text-destructive">*</span></Label>
              <Input value={operadora} onChange={e => setOperadora(e.target.value)} placeholder="Ex.: CVC, Azul Viagens…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Validade do crédito</Label>
              <Input type="date" value={validade} onChange={e => setValidade(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Observações</Label>
            <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button variant="destructive" disabled={saving} onClick={handleConfirm}>
            {saving ? 'Cancelando…' : 'Cancelar reserva e gerar crédito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
