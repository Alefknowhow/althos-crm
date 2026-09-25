'use client'

/**
 * Itens do Catálogo vinculados a esta oportunidade (issue #21 — "Uma
 * Oportunidade pode selecionar um ou vários itens [do Catálogo]"). Preço
 * gravado como snapshot no momento em que o item é adicionado — mudar o
 * preço no Catálogo depois não altera o que já foi selecionado aqui.
 *
 * "Ao ganhar, esses itens podem originar a Venda" (issue #21) — "Registrar
 * venda" cria a Venda (issue #20) com snapshot próprio dos itens
 * (sale_items), sem depender de mudar de etapa no board (é uma ação
 * explícita do usuário, não um efeito colateral de mover o card). "Usar
 * como valor do negócio" continua manual e independente — grava só em
 * contatos.value_cents via updateLeadValue.
 */

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X, ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { ActionButton as Button } from '@/components/features/ActionButton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  listContatoCatalogItems, addContatoCatalogItem, updateContatoCatalogItemQuantity, removeContatoCatalogItem,
} from '@/actions/contato-catalog-items'
import { listProducts } from '@/actions/products'
import { updateLeadValue } from '@/actions/contatos'
import { createSaleFromContatoCatalogItems } from '@/actions/sales-from-opportunity'
import { formatCurrency } from '@/lib/utils'

type CatalogItem = {
  id: string
  product_id: string
  quantity: number
  unit_price_cents: number
  products: { name: string; type: string } | null
}

export default function LeadCatalogItemsTab({ orgSlug, leadId }: { orgSlug: string; leadId: string }) {
  const router = useRouter()
  const [items, setItems] = useState<CatalogItem[] | null>(null)
  const [products, setProducts] = useState<{ id: string; name: string; price_cents: number }[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [adding, setAdding] = useState(false)
  const [registeringSale, setRegisteringSale] = useState(false)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    listContatoCatalogItems(orgSlug, leadId).then(data => { if (active) setItems(data as any) })
    return () => { active = false }
  }, [orgSlug, leadId, revision])

  useEffect(() => {
    let active = true
    listProducts(orgSlug, { isActive: true, pageSize: 200 }).then(res => {
      if (active) setProducts((res.data || []).map((p: any) => ({ id: p.id, name: p.name, price_cents: p.price_cents })))
    })
    return () => { active = false }
  }, [orgSlug])

  const total = useMemo(
    () => (items || []).reduce((acc, it) => acc + it.unit_price_cents * it.quantity, 0),
    [items],
  )

  async function handleAdd() {
    if (!selectedProductId) return
    setAdding(true)
    const res = await addContatoCatalogItem(orgSlug, leadId, selectedProductId)
    setAdding(false)
    if (!res.ok) { toast.error(res.error); return }
    setSelectedProductId('')
    setRevision(r => r + 1)
  }

  async function handleQuantity(itemId: string, quantity: number) {
    const res = await updateContatoCatalogItemQuantity(orgSlug, itemId, quantity)
    if (!res.ok) { toast.error(res.error); return }
    setRevision(r => r + 1)
  }

  async function handleRemove(itemId: string) {
    const res = await removeContatoCatalogItem(orgSlug, itemId)
    if (!res.ok) { toast.error(res.error); return }
    setRevision(r => r + 1)
  }

  async function useAsDealValue() {
    const res = await updateLeadValue(orgSlug, leadId, total)
    if (!res?.ok) { toast.error('Erro ao atualizar valor do negócio'); return }
    toast.success('Valor do negócio atualizado')
  }

  async function registerSale() {
    setRegisteringSale(true)
    const res = await createSaleFromContatoCatalogItems(orgSlug, leadId)
    setRegisteringSale(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Venda registrada com os itens desta oportunidade')
    router.push(`/app/${orgSlug}/vendas`)
  }

  if (items === null) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione um item do catálogo..." /></SelectTrigger>
          <SelectContent>
            {products.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price_cents)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" size="sm" onClick={handleAdd} disabled={!selectedProductId || adding}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground py-4 text-center">Nenhum item do catálogo vinculado a esta oportunidade.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-2 rounded-md border p-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.products?.name || 'Item removido'}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(item.unit_price_cents)} / un.</p>
              </div>
              <Input
                type="number" min={1} value={item.quantity}
                onChange={e => handleQuantity(item.id, parseInt(e.target.value) || 1)}
                className="w-16 h-8 text-xs"
              />
              <p className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(item.unit_price_cents * item.quantity)}</p>
              <button type="button" onClick={() => handleRemove(item.id)} className="text-muted-foreground hover:text-destructive" aria-label="Remover item">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center justify-between border-t pt-2">
            <p className="text-sm font-semibold">Total: {formatCurrency(total)}</p>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={useAsDealValue}>
                Usar como valor do negócio
              </Button>
              <Button type="button" size="sm" onClick={registerSale} disabled={registeringSale}>
                <ShoppingCart className="h-4 w-4 mr-1" /> Registrar venda
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
