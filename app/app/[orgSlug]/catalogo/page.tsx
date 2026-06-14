import { listProducts, getCategories } from '@/actions/products'
import CatalogFilters from '@/components/features/catalog/CatalogFilters'
import CatalogSplit from '@/components/features/catalog/CatalogSplit'
import ProductDialog from '@/components/features/catalog/ProductDialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EmptyState from '@/components/ui/empty-state'
import { Package, Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'

export default async function CatalogPage({
  params,
  searchParams
}: {
  params: { orgSlug: string }
  searchParams: { q?: string, page?: string, category?: string, type?: string, active?: string }
}) {
  const { orgSlug } = params
  const type = searchParams.type || 'all'
  const category = searchParams.category
  const search = searchParams.q
  const isActive = searchParams.active !== 'false'
  const page = parseInt(searchParams.page || '1')

  const result = await listProducts(orgSlug, {
    search,
    type: type === 'all' ? undefined : type,
    category,
    isActive,
    page,
  })

  const products = result.ok ? result.data : []
  const categoriesResult = await getCategories(orgSlug)
  const categories = categoriesResult.ok ? (categoriesResult.data as string[]) : []

  // Function to build tab URL
  const getTabUrl = (tabType: string) => {
    const params = new URLSearchParams(searchParams as any)
    if (tabType === 'all') params.delete('type')
    else params.set('type', tabType)
    params.delete('page') // Reset page on tab change
    return `/app/${orgSlug}/catalogo?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catálogo de Produtos e Serviços"
        hint="Gerencie o que você oferece aos seus clientes."
        actions={<ProductDialog orgSlug={orgSlug} categories={categories} />}
      />

      <div className="space-y-4">
        <Tabs defaultValue={type} className="w-full">
          <TabsList className="grid w-full max-w-[400px] grid-cols-3">
            <TabsTrigger value="all" asChild>
              <Link href={getTabUrl('all')}>Todos</Link>
            </TabsTrigger>
            <TabsTrigger value="product" asChild>
              <Link href={getTabUrl('product')}>Produtos</Link>
            </TabsTrigger>
            <TabsTrigger value="service" asChild>
              <Link href={getTabUrl('service')}>Serviços</Link>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <CatalogFilters orgSlug={orgSlug} categories={categories} />
        
        {products && products.length > 0 ? (
          <div className="space-y-4">
            <CatalogSplit products={products} orgSlug={orgSlug} categories={categories} />

            {/* Simple Pagination */}
            {result.count && result.count > 25 && (
              <div className="flex justify-center gap-2 pt-4">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page <= 1}
                  asChild={page > 1}
                >
                  {page > 1 ? (
                    <Link href={`/app/${orgSlug}/catalogo?${new URLSearchParams({...searchParams, page: (page - 1).toString()}).toString()}`}>
                      Anterior
                    </Link>
                  ) : (
                    <span>Anterior</span>
                  )}
                </Button>
                <div className="flex items-center px-4 text-sm text-muted-foreground">
                  Página {page} de {Math.ceil(result.count / 25)}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page >= Math.ceil(result.count / 25)}
                  asChild={page < Math.ceil(result.count / 25)}
                >
                  {page < Math.ceil(result.count / 25) ? (
                    <Link href={`/app/${orgSlug}/catalogo?${new URLSearchParams({...searchParams, page: (page + 1).toString()}).toString()}`}>
                      Próxima
                    </Link>
                  ) : (
                    <span>Próxima</span>
                  )}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="py-12">
            <EmptyState
              icon={Package}
              title={search || category || type !== 'all' ? "Nenhum item encontrado" : "Seu catálogo está vazio"}
              description={search || category || type !== 'all'
                ? "Tente ajustar seus filtros para encontrar o que procura."
                : "Adicione seu primeiro produto ou serviço para começar a gerenciar suas ofertas."
              }
              actionLabel="Adicionar Primeiro Item"
              actionHref="#" // Usado como fallback se action não for passado
            >
               <ProductDialog 
                orgSlug={orgSlug} 
                categories={categories} 
                trigger={<Button size="lg" className="mt-4"><Plus className="w-4 h-4 mr-2" /> Adicionar Primeiro Item</Button>} 
               />
            </EmptyState>
          </div>
        )}
      </div>
    </div>
  )
}
