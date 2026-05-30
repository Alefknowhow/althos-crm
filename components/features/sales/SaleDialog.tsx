'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import LeadCombobox from '@/components/features/LeadCombobox'
import { createSale, updateSale } from '@/actions/sales'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import { traduzirErro } from '@/lib/utils/error-translator'

type Member = { id: string; name: string; email: string; role: string }
type Product = { id: string; name: string; type: string; price_cents: number }

interface Props {
  orgSlug: string
  members: Member[]
  products: Product[]
  currentUserId: string
  trigger: React.ReactNode
  initial?: any
}

export default function SaleDialog({ orgSlug, members, products, currentUserId, trigger, initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const [productId, setProductId] = useState<string>(initial?.product_id || '')
  const [leadId, setLeadId] = useState<string>(initial?.lead_id || '')
  const [sellerId, setSellerId] = useState<string>(initial?.seller_id || currentUserId)
  const [saleDate, setSaleDate] = useState<string>(initial?.sale_date || new Date().toISOString().slice(0, 10))
  const [quantity, setQuantity] = useState<number>(initial?.quantity || 1)
  const [amountDisplay, setAmountDisplay] = useState<string>(formatCurrency(initial?.amount_cents || 0))
  const [amountCents, setAmountCents] = useState<number>(initial?.amount_cents || 0)
  const [paymentMethod, setPaymentMethod] = useState<string>(initial?.payment_method || '')
  const [installments, setInstallments] = useState<number>(initial?.installments || 1)
  const [status, setStatus] = useState<'pending' | 'completed' | 'cancelled'>(initial?.status || 'completed')
  const [notes, setNotes] = useState<string>(initial?.notes || '')

  const handleProductChange = (id: string) => {
    setProductId(id)
    const p = products.find(x => x.id === id)
    if (p && (!initial || amountCents === 0)) {
      const total = p.price_cents * quantity
      setAmountCents(total)
      setAmountDisplay(formatCurrency(total))
    }
  }

  const handleQuantityChange = (q: number) => {
    setQuantity(q)
    const p = products.find(x => x.id === productId)
    if (p && !initial) {
      const total = p.price_cents * q
      setAmountCents(total)
      setAmountDisplay(formatCurrency(total))
    }
  }

  const handleAmountChange = (v: string) => {
    const cents = parseCurrency(v)
    setAmountCents(cents)
    setAmountDisplay(formatCurrency(cents))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      const payload = {
        lead_id: leadId || null,
        product_id: productId || null,
        seller_id: sellerId || null,
        sale_date: saleDate,
        quantity,
        amount_cents: amountCents,
        payment_method: paymentMethod || null,
        installments,
        status,
        notes: notes || null,
      }
      const res = initial
        ? await updateSale(orgSlug, initial.id, payload)
        : await createSale(orgSlug, payload)
      if (res.ok) {
        toast.success(initial ? 'Venda atualizada' : 'Venda registrada')
        setOpen(false)
        router.refresh()
      } else {
        toast.error(traduzirErro(res.error, 'Erro ao salvar venda'))
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Editar venda' : 'Registrar venda'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lead</Label>
              <LeadCombobox
                name="lead_id"
                orgSlug={orgSlug}
                defaultLead={initial?.leads ? { id: initial.leads.id, name: initial.leads.name } : null}
                onChange={(l) => setLeadId(l?.id || '')}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Produto / Serviço</Label>
              <Select value={productId} onValueChange={handleProductChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um item" />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">Cadastre itens no Catálogo primeiro.</div>
                  )}
                  {products.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} {p.type === 'service' ? '· Serviço' : '· Produto'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Data</Label>
              <Input type="date" value={saleDate} onChange={e => setSaleDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Qtd.</Label>
              <Input type="number" min={1} value={quantity} onChange={e => handleQuantityChange(parseInt(e.target.value || '1'))} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Valor praticado (total)</Label>
              <Input value={amountDisplay} onChange={e => handleAmountChange(e.target.value)} placeholder="R$ 0,00" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Forma de pagamento</Label>
              <Select value={paymentMethod || 'none'} onValueChange={(v) => setPaymentMethod(v === 'none' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="debito">Cartão de Débito</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Parcelas</Label>
              <Input type="number" min={1} value={installments} onChange={e => setInstallments(parseInt(e.target.value || '1'))} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v: any) => setStatus(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">Concluída</SelectItem>
                  <SelectItem value="pending">Pendente</SelectItem>
                  <SelectItem value="cancelled">Cancelada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Vendedor</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o vendedor" />
              </SelectTrigger>
              <SelectContent>
                {members.map(m => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} {m.id === currentUserId ? '(você)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Observações</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Condições especiais, contexto, próximos passos..."
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? 'Salvando...' : (initial ? 'Salvar' : 'Registrar venda')}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

