'use client'

import { useEffect, useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { cn, formatCurrency } from '@/lib/utils'
import { listAvailableCreditsForContato, applyCreditToSale, type TravelCreditRow } from '@/actions/travel-credits'
import { toast } from 'sonner'
import { Wallet, Loader2 } from 'lucide-react'

function centsToReais(c: number) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export default function ApplyCreditDialog({
  open, onOpenChange, orgSlug, contatoId, saleId, remainingCents, onApplied,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orgSlug: string
  contatoId: string
  saleId: string
  remainingCents: number
  onApplied: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [credits, setCredits] = useState<TravelCreditRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [valorText, setValorText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    listAvailableCreditsForContato(orgSlug, contatoId).then(list => {
      setCredits(list)
      setLoading(false)
      if (list.length > 0) {
        const first = list[0]
        const saldo = first.valor_cents - first.valor_usado_cents
        setSelectedId(first.id)
        setValorText(centsToReais(Math.min(saldo, remainingCents > 0 ? remainingCents : saldo)))
      }
    })
  }, [open, orgSlug, contatoId, remainingCents])

  const selected = credits.find(c => c.id === selectedId) || null
  const saldoSelecionado = selected ? selected.valor_cents - selected.valor_usado_cents : 0

  function handleSelect(id: string) {
    setSelectedId(id)
    const c = credits.find(cr => cr.id === id)
    if (c) {
      const saldo = c.valor_cents - c.valor_usado_cents
      setValorText(centsToReais(Math.min(saldo, remainingCents > 0 ? remainingCents : saldo)))
    }
  }

  async function handleApply() {
    if (!selected) { toast.error('Selecione um crédito.'); return }
    const valorCents = reaisToCents(valorText)
    if (!valorCents || valorCents <= 0) { toast.error('Informe um valor válido.'); return }
    if (valorCents > saldoSelecionado) { toast.error('Valor maior que o saldo disponível do crédito.'); return }

    setSaving(true)
    const res = await applyCreditToSale(orgSlug, { creditId: selected.id, saleId, valorCents })
    setSaving(false)

    if (!res.ok) { toast.error(res.error); return }
    toast.success('Crédito aplicado à venda.')
    onOpenChange(false)
    onApplied()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Wallet className="w-4 h-4 text-primary" /> Usar crédito de viagem</DialogTitle>
          <DialogDescription>Selecione um crédito disponível do cliente para aplicar nesta venda.</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Carregando créditos…
          </div>
        ) : credits.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Este cliente não possui créditos de viagem disponíveis.
          </div>
        ) : (
          <div className="py-2 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Crédito</Label>
              <div className="space-y-1.5">
                {credits.map(c => {
                  const saldo = c.valor_cents - c.valor_usado_cents
                  const active = c.id === selectedId
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelect(c.id)}
                      className={cn(
                        'w-full text-left rounded-lg border p-2.5 transition-colors',
                        active ? 'bg-primary/5 border-primary' : 'hover:bg-muted/50 border-border',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{c.operadora}</span>
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(saldo)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {c.validade ? `Válido até ${new Date(c.validade + 'T12:00:00').toLocaleDateString('pt-BR')}` : 'Sem validade definida'}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Valor a aplicar</Label>
              <Input inputMode="decimal" placeholder="R$ 0,00" value={valorText} onChange={e => setValorText(e.target.value)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={saving || loading || credits.length === 0} onClick={handleApply}>
            {saving ? 'Aplicando…' : 'Aplicar crédito'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
