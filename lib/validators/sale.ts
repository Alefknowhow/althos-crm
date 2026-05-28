import { z } from 'zod'

export const saleInputSchema = z.object({
  lead_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  seller_id: z.string().uuid().nullable().optional(),
  sale_date: z.string().min(1, 'Informe a data'),
  quantity: z.coerce.number().int().min(1, 'Mínimo 1').default(1),
  amount_cents: z.coerce.number().int().min(0, 'Valor não pode ser negativo'),
  payment_method: z.string().optional().nullable(),
  installments: z.coerce.number().int().min(1).default(1).optional(),
  status: z.enum(['pending', 'completed', 'cancelled']).default('completed'),
  notes: z.string().optional().nullable(),
})

export type SaleInput = z.infer<typeof saleInputSchema>
