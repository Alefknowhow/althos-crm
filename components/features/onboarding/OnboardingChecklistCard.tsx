/**
 * Server component: computes the getting-started checklist for an org from
 * real data and hands it to the client OnboardingChecklist for rendering +
 * dismissal. Self-contained — drop <OnboardingChecklistCard orgId orgSlug />
 * anywhere on a server page.
 *
 * Step completion is purely derived (no separate flag writes):
 *   - Marca:      organizations.logo_url is set
 *   - 1º lead:    at least one row in leads
 *   - Formulário: at least one row in forms
 *   - WhatsApp:   organizations.whatsapp_phone_number_id is set
 *   - IA:         organizations.ai_enabled (runs on the platform token)
 */

import { createClient } from '@/lib/supabase/server'
import OnboardingChecklist, { type ChecklistStep } from './OnboardingChecklist'

export default async function OnboardingChecklistCard({
  orgId,
  orgSlug,
}: {
  orgId: string
  orgSlug: string
}) {
  const supabase = createClient()

  const [{ data: org }, leadsRes, formsRes] = await Promise.all([
    supabase
      .from('organizations')
      .select('logo_url, whatsapp_phone_number_id, ai_enabled')
      .eq('id', orgId)
      .maybeSingle(),
    supabase
      .from('contatos')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
    supabase
      .from('forms')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId),
  ])

  const hasLeads = (leadsRes.count ?? 0) > 0
  const hasForms = (formsRes.count ?? 0) > 0
  const hasLogo = !!org?.logo_url
  const hasWhatsapp = !!org?.whatsapp_phone_number_id
  const hasAi = !!org?.ai_enabled

  const base = `/app/${orgSlug}`

  const steps: ChecklistStep[] = [
    {
      id: 'brand',
      label: 'Personalize sua marca',
      description: 'Adicione seu logo e a cor principal do CRM.',
      href: `${base}/configuracoes`,
      done: hasLogo,
    },
    {
      id: 'lead',
      label: 'Cadastre seu primeiro lead',
      description: 'Importe ou crie um lead para começar a vender.',
      href: `${base}/contatos`,
      done: hasLeads,
    },
    {
      id: 'form',
      label: 'Crie um formulário de captação',
      description: 'Publique um link e receba leads direto no pipeline.',
      href: `${base}/forms`,
      done: hasForms,
    },
    {
      id: 'whatsapp',
      label: 'Conecte o WhatsApp',
      description: 'Centralize as conversas dentro do CRM.',
      href: `${base}/configuracoes/whatsapp`,
      done: hasWhatsapp,
    },
    {
      id: 'ai',
      label: 'Ative a Inteligência Artificial',
      description: 'Qualificação de leads e atendimento automáticos.',
      href: `${base}/configuracoes/ia`,
      done: hasAi,
    },
  ]

  return <OnboardingChecklist orgSlug={orgSlug} steps={steps} />
}
