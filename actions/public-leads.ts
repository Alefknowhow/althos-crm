'use server'

import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { getResend, EMAIL_FROM } from '@/lib/resend'

/**
 * Captação de leads do site institucional (fora do CRM multi-tenant, sem
 * organization_id) — hoje só o formulário "Fale com vendas" do plano
 * Business, que antes só abria um mailto:.
 */

const SalesLeadSchema = z.object({
  name: z.string().trim().min(2, 'Nome é obrigatório').max(120),
  email: z.string().trim().email('E-mail inválido'),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  company: z.string().trim().max(160).optional().or(z.literal('')),
  message: z.string().trim().max(2000).optional().or(z.literal('')),
})

async function insertMarketingLead(
  source: string,
  subjectLabel: string,
  raw: unknown,
) {
  const parsed = SalesLeadSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0].message }
  }
  const { name, email, phone, company, message } = parsed.data

  const admin = createAdminClient()
  const { error } = await admin.from('marketing_leads').insert({
    source,
    name,
    email,
    phone: phone || null,
    company: company || null,
    message: message || null,
  })

  if (error) return { ok: false as const, error: 'Erro ao enviar. Tente novamente em instantes.' }

  // Notifica o time comercial — falha de e-mail não deve derrubar o envio do
  // lead (já está gravado em marketing_leads acima).
  try {
    await getResend().emails.send({
      from: EMAIL_FROM,
      to: 'suporte@althoscrm.com.br',
      subject: `Novo lead — ${subjectLabel}: ${name}`,
      text: [
        `Nome: ${name}`,
        `E-mail: ${email}`,
        phone ? `Telefone: ${phone}` : null,
        company ? `Empresa: ${company}` : null,
        message ? `Mensagem: ${message}` : null,
      ].filter(Boolean).join('\n'),
    })
  } catch (e) {
    console.error(`insertMarketingLead(${source}): falha ao notificar por e-mail`, e)
  }

  return { ok: true as const }
}

export async function submitBusinessLead(raw: unknown) {
  return insertMarketingLead('business_plan', 'Plano Business', raw)
}

/** Lista de espera dos módulos de nicho ainda em construção (Advocacia, Seguros). */
export async function submitNicheWaitlist(niche: string, raw: unknown) {
  return insertMarketingLead(`waitlist_${niche}`, `Lista de espera — ${niche}`, raw)
}
