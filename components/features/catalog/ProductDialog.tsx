'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import ProductForm from './ProductForm'
import { Plus } from 'lucide-react'

interface ProductDialogProps {
  orgSlug: string
  product?: any
  trigger?: React.ReactNode
  categories?: string[]
}

export default function ProductDialog({ orgSlug, product, trigger, categories }: ProductDialogProps) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{product ? 'Editar Item' : 'Novo Item no Catálogo'}</DialogTitle>
        </DialogHeader>
        <ProductForm 
          orgSlug={orgSlug} 
          initialData={product} 
          categories={categories}
          onSuccess={() => setOpen(false)} 
        />
      </DialogContent>
    </Dialog>
  )
}
