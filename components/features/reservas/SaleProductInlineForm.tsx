'use client'

/**
 * Formulário de produto da Reserva — inline, dentro da própria lista com
 * scroll, em vez do Dialog grande anterior (issue #11 §1/§3: "a experiência
 * deixa de depender de um popup... lista editável com scroll"). Reaproveita
 * os mesmos campos por tipo (AereoFormFields/HospedagemFormFields/
 * GenericProductFields/KIND_FIELDS/ProductKindPicker) — só o container
 * mudou, nenhuma regra de validação/campo foi alterada.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import {
  createSaleProduct, updateSaleProduct, type SaleProduct, type SaleProductKind,
} from '@/actions/sale-products'
import { AereoFormFields, HospedagemFormFields } from '@/components/features/reservas/SaleProductDedicatedForms'
import { KIND_FIELDS, ProductKindPicker, GenericProductFields } from '@/components/features/reservas/SaleProductKindConfig'

export default function SaleProductInlineForm({
  orgSlug, saleId, product, onClose, onSaved,
}: {
  orgSlug: string
  saleId: string
  product: SaleProduct | null
  onClose: () => void
  onSaved: () => void
}) {
  // Produto novo começa sem tipo escolhido — mostra a grade de tipos
  // primeiro; escolher um avança direto pro formulário. Editar um produto
  // existente já entra direto no formulário, com o tipo fixo.
  const [kind, setKind] = useState<SaleProductKind | null>(product?.kind ?? null)
  const [data, setData] = useState<Record<string, any>>(product?.data || {})
  const [saving, setSaving] = useState(false)

  const fields = kind ? KIND_FIELDS[kind] : []

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
    <div className="rounded-lg border-2 border-primary/30 bg-muted/10 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {product ? 'Editar produto' : 'Adicionar produto'}
        </p>
        <Button type="button" size="icon" variant="ghost" className="h-6 w-6" onClick={onClose} aria-label="Fechar" disabled={saving}>
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>

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

          <div className="flex items-center justify-end gap-2 pt-1 border-t">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Salvando…</> : 'Salvar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
