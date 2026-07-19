'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'
import ProductDialog from './ProductDialog'
import { deleteProduct, createProduct } from '@/actions/products'
import { toast } from 'sonner'
import {
  Package, Wrench, Tag, Clock, BarChart3, StickyNote, Edit, Copy, Trash2,
  ExternalLink, ChevronLeft, Boxes,
} from 'lucide-react'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface CatalogSplitProps {
  products: any[]
  orgSlug: string
  categories?: string[]
}

export default function CatalogSplit({ products, orgSlug, categories }: CatalogSplitProps) {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<string | null>(products[0]?.id ?? null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [mobileDetail, setMobileDetail] = useState(false)

  // Keep a valid selection as the list changes (filters / deletions).
  useEffect(() => {
    if (!products.some(p => p.id === selectedId)) {
      setSelectedId(products[0]?.id ?? null)
    }
  }, [products, selectedId])

  const selected = useMemo(
    () => products.find(p => p.id === selectedId) ?? null,
    [products, selectedId],
  )

  async function handleDelete(id: string) {
    const result = await deleteProduct(orgSlug, id)
    if (result.ok) {
      toast.success('Item excluído com sucesso')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  async function handleDuplicate(product: any) {
    const { id, created_at, updated_at, ...rest } = product
    const result = await createProduct(orgSlug, { ...rest, name: `${product.name} (Cópia)`, is_active: true })
    if (result.ok) {
      toast.success('Item duplicado com sucesso')
      router.refresh()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-260px)] lg:min-h-[460px]">
      {/* ── Master: compact list ─────────────────────────────────── */}
      <div
        className={cn(
          'lg:w-1/2 lg:shrink-0 rounded-none border bg-card overflow-y-auto',
          mobileDetail && 'hidden lg:block',
        )}
      >
        <div className="divide-y">
          {products.map(product => {
            const active = product.id === selectedId
            const isService = product.type === 'service'
            return (
              <button
                key={product.id}
                onClick={() => { setSelectedId(product.id); setMobileDetail(true) }}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-center gap-3 transition-colors',
                  active ? 'bg-primary/10' : 'hover:bg-muted/40',
                )}
              >
                <span className={cn(
                  'shrink-0 w-9 h-9 rounded-lg grid place-items-center',
                  isService ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600',
                )}>
                  {isService ? <Wrench className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{product.name}</span>
                    {!product.is_active && (
                      <Badge variant="outline" className="text-[9px] px-1 h-4 shrink-0 bg-red-50 text-red-600 border-red-200">Inativo</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {product.category || (isService ? 'Serviço' : 'Produto')}
                    {product.sku && <span className="uppercase"> · {product.sku}</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(product.price_cents)}</span>
              </button>
            )
          })}
          {products.length === 0 && (
            <div className="px-4 py-12 text-center text-sm text-muted-foreground">Nenhum item.</div>
          )}
        </div>
      </div>

      {/* ── Detail panel ─────────────────────────────────────────── */}
      <div
        className={cn(
          'lg:w-1/2 lg:flex-1 rounded-none border bg-card overflow-y-auto',
          !mobileDetail && 'hidden lg:block',
        )}
      >
        {selected ? (
          <ProductDetail
            product={selected}
            orgSlug={orgSlug}
            categories={categories}
            onBack={() => setMobileDetail(false)}
            onDuplicate={() => handleDuplicate(selected)}
            onDelete={() => setDeleteId(selected.id)}
          />
        ) : (
          <div className="h-full grid place-items-center p-10 text-center">
            <div className="space-y-2 text-muted-foreground">
              <Boxes className="w-10 h-10 mx-auto opacity-40" />
              <p className="text-sm">Selecione um item para ver os detalhes.</p>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir este item? Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function ProductDetail({
  product, orgSlug, categories, onBack, onDuplicate, onDelete,
}: {
  product: any
  orgSlug: string
  categories?: string[]
  onBack: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const isService = product.type === 'service'
  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="lg:hidden mt-1 text-muted-foreground hover:text-foreground" aria-label="Voltar">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className={cn(
          'shrink-0 w-12 h-12 rounded-none grid place-items-center',
          isService ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600',
        )}>
          {isService ? <Wrench className="w-5 h-5" /> : <Package className="w-5 h-5" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold leading-tight">{product.name}</h2>
            <Badge variant="outline" className={product.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}>
              {product.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{isService ? 'Serviço' : 'Produto'}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <ProductDialog
          orgSlug={orgSlug}
          product={product}
          categories={categories}
          trigger={<Button size="sm" variant="outline"><Edit className="w-4 h-4 mr-1.5" /> Editar</Button>}
        />
        <Button size="sm" variant="outline" onClick={onDuplicate}><Copy className="w-4 h-4 mr-1.5" /> Duplicar</Button>
        <Button size="sm" variant="outline" asChild>
          <Link href={`/app/${orgSlug}/catalogo/${product.id}`}><ExternalLink className="w-4 h-4 mr-1.5" /> Página completa</Link>
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete} className="text-destructive hover:bg-destructive/10 ml-auto">
          <Trash2 className="w-4 h-4 mr-1.5" /> Excluir
        </Button>
      </div>

      {/* Price + duration/stock */}
      <div className="grid grid-cols-2 gap-3">
        <Field icon={Tag} label="Preço sugerido">
          <span className="text-2xl font-bold text-primary">{formatCurrency(product.price_cents)}</span>
        </Field>
        {isService ? (
          <Field icon={Clock} label="Duração estimada">
            <span className="text-2xl font-bold">{product.duration_minutes ? `${product.duration_minutes} min` : 'N/A'}</span>
          </Field>
        ) : (
          <Field icon={Package} label="Estoque atual">
            <span className="text-2xl font-bold">{product.stock_count !== null ? `${product.stock_count} un` : 'N/A'}</span>
          </Field>
        )}
      </div>

      {/* Category + SKU */}
      <div className="grid grid-cols-2 gap-3 pt-1">
        <Field icon={BarChart3} label="Categoria">
          <span className="text-sm font-medium">{product.category || 'Não categorizado'}</span>
        </Field>
        <Field icon={Tag} label="SKU / Código">
          <span className="text-sm font-mono">{product.sku || 'Sem código'}</span>
        </Field>
      </div>

      {/* Description */}
      {product.description && (
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{product.description}</p>
        </div>
      )}

      {/* Internal notes */}
      <div className="rounded-lg border bg-muted/20 p-4 space-y-1.5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <StickyNote className="w-4 h-4 text-amber-500" /> Notas internas
        </div>
        <p className="text-sm text-muted-foreground">
          {product.notes || 'Nenhuma nota interna registrada para este item.'}
        </p>
      </div>
    </div>
  )
}

function Field({ icon: Icon, label, children }: { icon: any; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-background p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      {children}
    </div>
  )
}
