'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { productInputSchema } from '@/lib/validators/product'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createProduct, updateProduct } from '@/actions/products'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'
import { formatCurrency, parseCurrency } from '@/lib/utils'
import { z } from 'zod'
import type { DocumentTemplateRow } from '@/actions/document-templates'

type ProductFormValues = z.infer<typeof productInputSchema>

interface ProductFormProps {
  orgSlug: string
  initialData?: any
  onSuccess?: (data: any) => void
  categories?: string[]
  /** Agências de Tráfego — revela campos de plano recorrente (duração +
   *  contrato padrão do plano). Genérico o bastante pra outras verticais
   *  usarem também, mas só exibido quando pedido explicitamente. */
  isTraffic?: boolean
  documentTemplates?: DocumentTemplateRow[]
}

export default function ProductForm({ orgSlug, initialData, onSuccess, categories = [], isTraffic, documentTemplates = [] }: ProductFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const form = useForm<ProductFormValues>({
    // zodResolver cast: @hookform/resolvers v5 tem incompatibilidade de tipos com zod v4
    resolver: zodResolver(productInputSchema as any),
    defaultValues: {
      name: initialData?.name || '',
      description: initialData?.description || '',
      type: initialData?.type || 'product',
      price_cents: initialData?.price_cents || 0,
      duration_minutes: initialData?.duration_minutes || null,
      category: initialData?.category || '',
      sku: initialData?.sku || '',
      stock_count: initialData?.stock_count || (initialData?.type === 'product' ? 0 : null),
      is_active: initialData?.is_active ?? true,
      notes: initialData?.notes || '',
      is_recurring: initialData?.is_recurring || false,
      duration_months: initialData?.duration_months || null,
      contract_template_id: initialData?.contract_template_id || null,
    },
  })

  const isRecurring = form.watch('is_recurring')

  const productType = form.watch('type')

  async function onSubmit(values: ProductFormValues) {
    setLoading(true)
    try {
      const result = initialData 
        ? await updateProduct(orgSlug, initialData.id, values)
        : await createProduct(orgSlug, values)

      if (result.ok) {
        toast.success(initialData ? 'Item atualizado com sucesso!' : 'Item criado com sucesso!')
        router.refresh()
        onSuccess?.((result as any).data)
      } else {
        toast.error(traduzirErro(result.error))
      }
    } catch (error) {
      toast.error('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  // Helper to format cents to R$ for display
  const [displayPrice, setDisplayPrice] = useState(formatCurrency(initialData?.price_cents || 0))

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const cents = parseCurrency(value)
    setDisplayPrice(formatCurrency(cents))
    form.setValue('price_cents', cents)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Tipo de Item</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex gap-4"
                >
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="product" />
                    </FormControl>
                    <FormLabel className="font-normal">Produto</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="service" />
                    </FormControl>
                    <FormLabel className="font-normal">Serviço</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome *</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: Consulta Inicial, Pomada XYZ" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_cents"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preço</FormLabel>
                <FormControl>
                  <Input 
                    value={displayPrice}
                    onChange={handlePriceChange}
                    placeholder="R$ 0,00"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Descreva o produto ou serviço..." 
                  className="resize-none" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {productType === 'service' && (
            <FormField
              control={form.control}
              name="duration_minutes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Duração (minutos)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Ex: 60" 
                      {...field} 
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {productType === 'product' && (
            <FormField
              control={form.control}
              name="stock_count"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estoque</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="Ex: 10" 
                      {...field} 
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : 0)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="category"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input 
                      placeholder="Ex: Atendimento, Cosméticos" 
                      {...field} 
                      value={field.value || ''}
                      list="categories-list"
                    />
                    <datalist id="categories-list">
                      {categories.map(cat => <option key={cat} value={cat} />)}
                    </datalist>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="sku"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SKU / Código</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: PROD-001" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas Internas</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Informações visíveis apenas para a equipe" 
                  {...field} 
                  value={field.value || ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isTraffic && (
          <div className="space-y-4 rounded-lg border p-4">
            <FormField
              control={form.control}
              name="is_recurring"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Plano recorrente (assinatura mensal)</FormLabel>
                    <FormDescription>
                      A venda deste plano vira uma assinatura com duração e contrato.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />

            {isRecurring && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="duration_months"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duração padrão (meses)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ex: 12"
                          {...field}
                          value={field.value || ''}
                          onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contract_template_id"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Contrato deste plano</FormLabel>
                        <a
                          href={`/app/${orgSlug}/documentos`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          Criar/editar contratos
                        </a>
                      </div>
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Nenhum template selecionado" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {documentTemplates.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Abre em outra aba — depois de criar/editar, volte aqui e selecione na lista.
                      </FormDescription>
                    </FormItem>
                  )}
                />
              </div>
            )}
          </div>
        )}

        <FormField
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">Ativo</FormLabel>
                <FormDescription>
                  Itens inativos não aparecerão em novas vendas ou agendamentos.
                </FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="flex justify-end gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Item'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
