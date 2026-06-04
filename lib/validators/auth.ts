import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

export const signupSchema = z
  .object({
    name: z.string().min(2, "Nome é obrigatório"),
    email: z.string().email("E-mail inválido"),
    password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1, "Confirme a senha"),
    acceptTerms: z
      .boolean()
      .refine((v) => v === true, "Você precisa aceitar os Termos de Serviço e a Política de Privacidade"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
