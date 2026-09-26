'use client'

/**
 * Lista de Produtos da Reserva — issue #11: a edição deixou de depender de
 * um popup (Dialog) e passou a expandir inline na própria lista com scroll
 * (SaleProductInlineForm), mantendo só o AlertDialog de exclusão como o
 * "pequeno diálogo adequado a uma ação pontual" que a issue permite manter.
 * Nenhum campo/validação/tipo de produto mudou — só o container de edição.
 */

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Package } from 'lucide-react'
import {
  listSaleProducts, updateSaleProduct, deleteSaleProduct,
  type SaleProduct,
} from '@/actions/sale-products'
import SaleProductCard from '@/components/features/reservas/SaleProductCard'
import SaleProductInlineForm from '@/components/features/reservas/SaleProductInlineForm'
import ModuleSection from '@/components/design/ModuleSection'

export default function SaleProductsTab({
  orgSlug, saleId, refreshKey,
}: {
  orgSlug: string
  saleId: string
  /** Muda quando um novo lote de produtos é criado (ex.: via OCR) pra forçar reload. */
  refreshKey?: number
}) {
  const [products, setProducts] = useState<SaleProduct[] | null>(null)
  // 'new' expande o formulário em branco no topo da lista; um id expande o
  // formulário logo abaixo daquele card específico (nunca os dois ao mesmo tempo).
  const [editingId, setEditingId] = useState<string | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  async function reload() {
    const rows = await listSaleProducts(orgSlug, saleId)
    setProducts(rows)
  }

  useEffect(() => { reload() }, [orgSlug, saleId, refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleStatus(p: SaleProduct) {
    const nextStatus = p.status === 'confirmed' ? 'pending' : 'confirmed'
    setProducts(prev => prev?.map(x => x.id === p.id ? { ...x, status: nextStatus } : x) ?? null)
    const res = await updateSaleProduct(orgSlug, p.id, { status: nextStatus })
    if (!res.ok) { toast.error(res.error); reload() }
  }

  async function handleDelete(id: string) {
    setProducts(prev => prev?.filter(p => p.id !== id) ?? null)
    const res = await deleteSaleProduct(orgSlug, id)
    if (!res.ok) { toast.error(res.error); reload() }
  }

  if (products === null) {
    return <div className="text-xs text-muted-foreground py-6 text-center">Carregando produtos…</div>
  }

  const editingProduct = editingId && editingId !== 'new' ? products.find(p => p.id === editingId) ?? null : null

  return (
    <div className="space-y-3">
      <ModuleSection title="Produtos" contentClassName="space-y-2">
        {editingId === 'new' && (
          <SaleProductInlineForm
            orgSlug={orgSlug}
            saleId={saleId}
            product={null}
            onClose={() => setEditingId(null)}
            onSaved={() => { setEditingId(null); reload() }}
          />
        )}

        {products.length === 0 && editingId === null ? (
          <div className="rounded-xl bg-muted/30 p-6 text-center space-y-2">
            <Package className="w-6 h-6 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Nenhum produto adicionado.</p>
            <p className="text-xs text-muted-foreground">Envie o voucher na aba Vouchers para preencher automaticamente, ou adicione manualmente.</p>
          </div>
        ) : (
          // Scroll próprio quando a lista crescer — issue #11 §3: "permitir
          // scroll quando a quantidade/conteúdo exigir".
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-0.5">
            {products.map(p => (
              <div key={p.id} className="space-y-2">
                <SaleProductCard
                  product={p}
                  onEdit={() => setEditingId(editingId === p.id ? null : p.id)}
                  onDelete={() => setDeleteTarget(p.id)}
                  onToggleStatus={() => handleToggleStatus(p)}
                />
                {editingProduct?.id === p.id && (
                  <SaleProductInlineForm
                    orgSlug={orgSlug}
                    saleId={saleId}
                    product={editingProduct}
                    onClose={() => setEditingId(null)}
                    onSaved={() => { setEditingId(null); reload() }}
                  />
                )}
              </div>
            ))}
          </div>
        )}

        {editingId === null && (
          <button
            type="button"
            onClick={() => setEditingId('new')}
            className="w-full rounded-xl border border-dashed py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
          >
            <Plus className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" /> Adicionar produto
          </button>
        )}
      </ModuleSection>

      <AlertDialog open={!!deleteTarget} onOpenChange={o => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (deleteTarget) handleDelete(deleteTarget); setDeleteTarget(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
