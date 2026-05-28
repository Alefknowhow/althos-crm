import { getProduct } from '@/actions/products'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Edit, Package, Clock, Tag, BarChart3, StickyNote } from 'lucide-react'
import Link from 'next/link'
import ProductDialog from '@/components/features/catalog/ProductDialog'
import { redirect } from 'next/navigation'

export default async function ProductDetailsPage({
  params
}: {
  params: { orgSlug: string, id: string }
}) {
  const { orgSlug, id } = params
  const result = await getProduct(orgSlug, id)

  if (!result.ok || !result.data) {
    redirect(`/app/${orgSlug}/catalogo`)
  }

  const product = result.data

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/app/${orgSlug}/catalogo`}>
            <ArrowLeft className="w-4 h-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{product.name}</h1>
            <Badge variant={product.is_active ? 'success' : 'destructive'} className={product.is_active ? 'bg-green-50 text-green-700 border-green-200' : ''}>
              {product.is_active ? 'Ativo' : 'Inativo'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground capitalize">{product.type === 'service' ? 'Serviço' : 'Produto'}</p>
        </div>
        <div className="flex gap-2">
          <ProductDialog 
            orgSlug={orgSlug} 
            product={product} 
            trigger={<Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Editar Item</Button>} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Informações Gerais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8">
            {product.description && (
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Descrição</label>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{product.description}</p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                   <Tag className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Preço Sugerido</span>
                </div>
                <p className="text-2xl font-bold text-primary">{formatCurrency(product.price_cents)}</p>
              </div>

              {product.type === 'service' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <Clock className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-wider">Duração Estimada</span>
                  </div>
                  <p className="text-2xl font-bold">{product.duration_minutes ? `${product.duration_minutes} min` : 'N/A'}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                     <Package className="w-4 h-4" />
                     <span className="text-xs font-bold uppercase tracking-wider">Estoque Atual</span>
                  </div>
                  <p className="text-2xl font-bold">{product.stock_count !== null ? `${product.stock_count} un` : 'N/A'}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4 border-t">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                   <BarChart3 className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">Categoria</span>
                </div>
                <p className="text-sm font-medium">{product.category || 'Não categorizado'}</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-muted-foreground">
                   <Tag className="w-4 h-4" />
                   <span className="text-xs font-bold uppercase tracking-wider">SKU / Código Interno</span>
                </div>
                <p className="text-sm font-mono">{product.sku || 'Sem código'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <StickyNote className="w-4 h-4 text-amber-500" />
                Notas Internas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {product.notes || 'Nenhuma nota interna registrada para este item.'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-muted/30 border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Histórico e Vínculos</CardTitle>
              <CardDescription className="text-xs">Vendas e agendamentos vinculados</CardDescription>
            </CardHeader>
            <CardContent>
              {/* TODO: Implementar lista de vendas e agendamentos nas próximas missões */}
              <div className="text-center py-6">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                  Módulo de Vendas em breve
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
