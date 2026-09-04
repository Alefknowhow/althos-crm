'use client'

import type { UseFormReturn } from 'react-hook-form'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'

/**
 * Recurring-plan fields (Agências de Tráfego only) for ProductForm.
 * Split out of ProductForm.tsx — purely presentational, form control
 * passed in via react-hook-form.
 */
export function ProductFormTrafficFields({ form, isRecurring }: { form: UseFormReturn<any>; isRecurring: boolean }) {
  return (
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
          {/* O contrato de cada venda deste plano tem conteúdo próprio,
              editável direto no popup "Gerenciar contrato" — não tem
              mais vínculo com um modelo/template escolhido aqui. */}
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
        </div>
      )}
    </div>
  )
}
