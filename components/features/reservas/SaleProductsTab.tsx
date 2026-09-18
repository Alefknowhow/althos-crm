'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Package, Loader2 } from 'lucide-react'
import {
  listSaleProducts, createSaleProduct, updateSaleProduct, deleteSaleProduct,
  type SaleProduct, type SaleProductKind,
} from '@/actions/sale-products'
import SaleProductCard from '@/components/features/reservas/SaleProductCard'
import { AereoFormFields, HospedagemFormFields } from '@/components/features/reservas/SaleProductDedicatedForms'
import { KIND_FIELDS, ProductKindPicker, GenericProductFields } from '@/components/features/reservas/SaleProductKindConfig'

export default function SaleProductsTab({
  orgSlug, saleId, refreshKey,
}: {
  orgSlug: string
  saleId: string
  /** Muda quando um novo lote de produtos é criado (ex.: via OCR) pra forçar reload. */
  refreshKey?: number
}) {
  const [products, setProducts] = useState<SaleProduct[] | null>(null)
  const [editing, setEditing] = useState<SaleProduct | 'new' | null>(null)
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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          Produtos da venda
        </p>
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar produto
        </Button>
      </div>

      {products.length === 0 ? (
        <div className="rounded-lg border bg-muted/20 p-6 text-center space-y-2">
          <Package className="w-6 h-6 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhum produto adicionado.</p>
          <p className="text-xs text-muted-foreground">Envie o voucher na aba Documentos para preencher automaticamente, ou adicione manualmente.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing('new')}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Adicionar produto
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <SaleProductCard
              key={p.id}
              product={p}
              onEdit={() => setEditing(p)}
              onDelete={() => setDeleteTarget(p.id)}
              onToggleStatus={() => handleToggleStatus(p)}
            />
          ))}
        </div>
      )}

      {editing && (
        <ProductFormDialog
          orgSlug={orgSlug}
          saleId={saleId}
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload() }}
        />
      )}

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
              onClick={() => { handleDelete(deleteTarget!); setDeleteTarget(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProductFormDialog({
  orgSlug, saleId, product, onClose, onSaved,
}: {
  orgSlug: string
  saleId: string
  product: SaleProduct | null
  onClose: () => void
  onSaved: () => void
}) {
  // Produto novo começa sem tipo escolhido — mostra a grade de tipos
  // primeiro; escolher um avança direto pro formulário (sem precisar de um
  // segundo clique num select). Editar um produto existente já entra
  // direto no formulário, com o tipo fixo.
  const [kind, setKind] = useState<SaleProductKind | null>(product?.kind ?? null)
  const [data, setData] = useState<Record<string, any>>(product?.data || {})
  const [saving, setSaving] = useState(false)

  const fields = kind ? KIND_FIELDS[kind] : []
  const dedicated = kind === 'aereo' || kind === 'hospedagem'

  function set(key: string, value: string | string[]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function setMany(patch: Record<string, string | string[]>) {
    setData(prev => ({ ...prev, ...patch }))
  }

  function missingRequiredLabel(): string | null {
    const missing = fields.find(f => f.required && !String(data[f.key] || '').trim())
    return missing ? missing.label : null
  }

  async function handleSave() {
    if (!kind) return
    const missing = missingRequiredLabel()
    if (missing) { toast.error(`Preencha "${missing}" antes de salvar.`); return }
    setSaving(true)
    const res = product
      ? await updateSaleProduct(orgSlug, product.id, { data })
      : await createSaleProduct(orgSlug, saleId, { kind, data })
    setSaving(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(product ? 'Produto atualizado' : 'Produto adicionado')
    onSaved()
  }

  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className={cn('max-h-[85vh] overflow-y-auto', kind && dedicated ? 'max-w-3xl' : 'max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Adicionar produto'}</DialogTitle>
        </DialogHeader>

        {!kind ? (
          <ProductKindPicker onPick={setKind} />
        ) : (
        <div className="space-y-3">
          {!product && (
            <button
              type="button"
              onClick={() => { setKind(null); setData({}) }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              ← Trocar tipo de produto
            </button>
          )}

          {kind === 'aereo' ? (
            <AereoFormFields data={data} set={set} setMany={setMany} />
          ) : kind === 'hospedagem' ? (
            <HospedagemFormFields data={data} set={set} />
          ) : (
            <GenericProductFields fields={fields} data={data} setData={setData} />
          )}
        </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          {kind && (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…</> : 'Salvar'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
