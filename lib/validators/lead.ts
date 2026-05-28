import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  stage_id: z.string().uuid("Estágio inválido").optional().or(z.literal("")),
  value_cents: z.number().int().min(0).optional(),
  tags: z.array(z.string()).optional(),
});
