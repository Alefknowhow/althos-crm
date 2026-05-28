'use client'

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MoreHorizontal, Edit, Copy, Trash, ExternalLink } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { formatCurrency } from '@/lib/utils'
import ProductDialog from './ProductDialog'
import { deleteProduct, createProduct } from '@/actions/products'
import { toast } from 'sonner'
import Link from 'next/link'

interface CatalogTableProps {
  products: any[]
  orgSlug: string
  categories?: string[]
}

export default function CatalogTable({ products, orgSlug, categories }: CatalogTableProps) {
  
  async function handleDelete(id: string) {
    if (confirm('Tem certeza que deseja excluir este item?')) {
      const result = await deleteProduct(orgSlug, id)
      if (result.ok) {
        toast.success('Item excluído com sucesso')
      } else {
        toast.error(result.error)
      }
    }
  }

  async function handleDuplicate(product: any) {
    const { id, created_at, updated_at, ...rest } = product
    const result = await createProduct(orgSlug, {
      ...rest,
      name: `${product.name} (Cópia)`,
      is_active: true
    })
    
    if (result.ok) {
      toast.success('Item duplicado com sucesso')
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="rounded-md border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Preço</TableHead>
            <TableHead>Duração / Estoque</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px] text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => (
            <TableRow key={product.id}>
              <TableCell className="font-medium">
                <Link href={`/app/${orgSlug}/catalogo/${product.id}`} className="hover:underline flex items-center gap-1 group">
                  {product.name}
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
                {product.sku && <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{product.sku}</div>}
              </TableCell>
              <TableCell>
                <Badge 
                  variant={product.type === 'service' ? 'secondary' : 'outline'} 
                  className={product.type === 'service' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-slate-50 text-slate-700 border-slate-200'}
                >
                  {product.type === 'service' ? 'Serviço' : 'Produto'}
                </Badge>
              </TableCell>
              <TableCell>{formatCurrency(product.price_cents)}</TableCell>
              <TableCell>
                {product.type === 'service' 
                  ? (product.duration_minutes ? `${product.duration_minutes} min` : '-')
                  : (product.stock_count !== null ? `${product.stock_count} un` : '-')
                }
              </TableCell>
              <TableCell>
                {product.category ? <Badge variant="outline" className="font-normal">{product.category}</Badge> : '-'}
              </TableCell>
              <TableCell>
                <Badge variant={product.is_active ? 'success' : 'destructive'} className={product.is_active ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-50' : ''}>
                  {product.is_active ? 'Ativo' : 'Inativo'}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Opções</DropdownMenuLabel>
                    <DropdownMenuItem asChild>
                      <Link href={`/app/${orgSlug}/catalogo/${product.id}`}>
                        <ExternalLink className="w-4 h-4 mr-2" /> Visualizar
                      </Link>
                    </DropdownMenuItem>
                    <ProductDialog 
                      orgSlug={orgSlug} 
                      product={product} 
                      categories={categories}
                      trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}><Edit className="w-4 h-4 mr-2" /> Editar</DropdownMenuItem>} 
                    />
                    <DropdownMenuItem onClick={() => handleDuplicate(product)}>
                      <Copy className="w-4 h-4 mr-2" /> Duplicar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDelete(product.id)} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                      <Trash className="w-4 h-4 mr-2" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
          {products.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                Nenhum item encontrado com os filtros selecionados.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
