'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
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

const KIND_OPTIONS: { value: SaleProductKind; label: string }[] = [
  { value: 'aereo', label: 'Aéreo' },
  { value: 'hospedagem', label: 'Hospedagem' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'passeio', label: 'Passeio' },
  { value: 'cruzeiro', label: 'Cruzeiro' },
  { value: 'seguro', label: 'Seguro' },
  { value: 'ingresso', label: 'Ingresso' },
  { value: 'veiculo', label: 'Locação de veículo' },
  { value: 'outro', label: 'Outro' },
]

type FieldDef = { key: string; label: string; type?: 'text' | 'date' | 'time' | 'number' | 'textarea' }

const KIND_FIELDS: Record<SaleProductKind, FieldDef[]> = {
  aereo: [
    { key: 'companhia', label: 'Companhia' },
    { key: 'numero_voo', label: 'Número do voo' },
    { key: 'sentido', label: 'Sentido (ida/volta)' },
    { key: 'localizador', label: 'Localizador (web check-in)' },
    { key: 'bilhete', label: 'Nº do bilhete' },
    { key: 'origem', label: 'Origem (código)' },
    { key: 'destino', label: 'Destino (código)' },
    { key: 'data', label: 'Data de embarque', type: 'date' },
    { key: 'hora_embarque', label: 'Hora de embarque' },
    { key: 'data_chegada', label: 'Data de chegada', type: 'date' },
    { key: 'hora_chegada', label: 'Hora de chegada' },
    { key: 'horario', label: 'Horário (partida-chegada)' },
    { key: 'passageiros', label: 'Passageiros' },
    { key: 'bagagem', label: 'Franquia de bagagem' },
  ],
  hospedagem: [
    { key: 'hotel', label: 'Hotel' },
    { key: 'localizador', label: 'Localizador (RES...)' },
    { key: 'titular', label: 'Titular da reserva' },
    { key: 'check_in', label: 'Check-in', type: 'date' },
    { key: 'hora_checkin', label: 'Horário do check-in' },
    { key: 'check_out', label: 'Check-out', type: 'date' },
    { key: 'hora_checkout', label: 'Horário do check-out' },
    { key: 'tipo_quarto', label: 'Tipo de quarto' },
    { key: 'regime', label: 'Regime' },
    { key: 'endereco', label: 'Endereço do hotel' },
    { key: 'email', label: 'E-mail do hotel' },
    { key: 'telefone', label: 'Telefone do hotel' },
    { key: 'informacoes_adicionais', label: 'Informações adicionais', type: 'textarea' },
    { key: 'politica_cancelamento', label: 'Política de cancelamento', type: 'textarea' },
    { key: 'condicoes', label: 'Condições da reserva', type: 'textarea' },
  ],
  transfer: [
    { key: 'origem', label: 'Origem' },
    { key: 'destino', label: 'Destino' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'horario', label: 'Horário' },
    { key: 'passageiros', label: 'Passageiros' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'tipo_servico', label: 'Tipo de serviço' },
  ],
  cruzeiro: [
    { key: 'companhia', label: 'Companhia' },
    { key: 'navio', label: 'Navio' },
    { key: 'roteiro', label: 'Roteiro' },
    { key: 'embarque_porto', label: 'Porto de embarque' },
    { key: 'embarque_data', label: 'Data de embarque', type: 'date' },
    { key: 'desembarque_porto', label: 'Porto de desembarque' },
    { key: 'desembarque_data', label: 'Data de desembarque', type: 'date' },
    { key: 'cabine', label: 'Cabine' },
    { key: 'categoria', label: 'Categoria' },
    { key: 'localizador', label: 'Localizador' },
  ],
  passeio: [
    { key: 'nome', label: 'Nome' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'localizador', label: 'Localizador' },
    { key: 'observacoes', label: 'Observações' },
  ],
  seguro: [
    { key: 'nome', label: 'Seguradora / plano' },
    { key: 'data', label: 'Vigência a partir de', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'localizador', label: 'Apólice' },
    { key: 'observacoes', label: 'Observações' },
  ],
  ingresso: [
    { key: 'nome', label: 'Nome' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'localizador', label: 'Localizador' },
    { key: 'observacoes', label: 'Observações' },
  ],
  veiculo: [
    { key: 'nome', label: 'Veículo' },
    { key: 'data', label: 'Retirada', type: 'date' },
    { key: 'fornecedor', label: 'Locadora' },
    { key: 'localizador', label: 'Localizador' },
    { key: 'observacoes', label: 'Observações' },
  ],
  outro: [
    { key: 'nome', label: 'Nome' },
    { key: 'data', label: 'Data', type: 'date' },
    { key: 'fornecedor', label: 'Fornecedor' },
    { key: 'localizador', label: 'Localizador' },
    { key: 'observacoes', label: 'Observações' },
  ],
}

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
  const [kind, setKind] = useState<SaleProductKind>(product?.kind || 'aereo')
  const [data, setData] = useState<Record<string, any>>(product?.data || {})
  const [saving, setSaving] = useState(false)

  const fields = KIND_FIELDS[kind]

  async function handleSave() {
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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar produto' : 'Adicionar produto'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {!product && (
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={kind} onValueChange={v => { setKind(v as SaleProductKind); setData({}) }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KIND_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            {fields.map(f => (
              <div key={f.key} className={cn('space-y-1.5', f.type === 'textarea' && 'col-span-2')}>
                <Label className="text-xs">{f.label}</Label>
                {f.type === 'textarea' ? (
                  <Textarea
                    rows={2}
                    className="text-xs"
                    value={data[f.key] || ''}
                    onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                ) : (
                  <Input
                    type={f.type === 'date' ? 'date' : 'text'}
                    value={data[f.key] || ''}
                    onChange={e => setData(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando…</> : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
