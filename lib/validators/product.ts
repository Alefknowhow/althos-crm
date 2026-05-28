import { z } from "zod";

export const productSchema = z.object({
  id: z.string().uuid(),
  organization_id: z.string().uuid(),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  description: z.string().optional().nullable(),
  type: z.enum(["product", "service"], {
    error: "Tipo é obrigatório",
  }),
  price_cents: z.number().int().min(0, "O preço não pode ser negativo"),
  duration_minutes: z.number().int().min(0, "A duração não pode ser negativa").optional().nullable(),
  category: z.string().optional().nullable(),
  sku: z.string().optional().nullable(),
  stock_count: z.number().int().optional().nullable(),
  is_active: z.boolean().default(true),
  notes: z.string().optional().nullable(),
  created_at: z.date().or(z.string()).optional(),
  updated_at: z.date().or(z.string()).optional(),
});

export const productInputSchema = productSchema.omit({
  id: true,
  organization_id: true,
  created_at: true,
  updated_at: true,
}).refine((data) => {
  if (data.type === "service" && data.duration_minutes === null) {
    // Optional: we could enforce duration for services if desired, 
    // but the prompt says "opcional mas >= 0 se preenchido"
    return true;
  }
  return true;
});
