import { getCurrentOrganization } from '@/lib/supabase/types'
import { getWhatsappConnectionStatus } from '@/actions/whatsapp'
import { getSocialConnections } from '@/actions/social-automations'
import { getGoogleBusinessConnections } from '@/actions/google-business'
import IntegrationsGrid, { type IntegrationCardData } from '@/components/features/integrations/IntegrationsGrid'

export default async function IntegracoesPage({ params }: { params: { orgSlug: string } }) {
  const orgSlug = params.orgSlug
  const org = await getCurrentOrganization(orgSlug)
  const base = `/app/${orgSlug}/configuracoes`

  const [whatsapp, instagramConnections, googleConnections] = await Promise.all([
    getWhatsappConnectionStatus(orgSlug),
    getSocialConnections(orgSlug),
    getGoogleBusinessConnections(orgSlug).catch(() => []),
  ])

  const items: IntegrationCardData[] = [
    {
      id: 'saude',
      title: 'Saúde das Integrações',
      category: 'Diagnóstico',
      description: 'Status, último erro e disponibilidade de WhatsApp, E-mail, Automações e Banco de Dados nos últimos 30 dias.',
      meta: 'Tempo real',
      connected: true,
      brand: 'health',
      moduleHref: `${base}/integracoes/saude`,
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      category: 'Comunicação',
      description: 'Atendimento, automações e agente de IA no WhatsApp Business.',
      meta: whatsapp.alreadyConnected
        ? whatsapp.displayPhone ? `Conectado — ${whatsapp.displayPhone}` : 'Conectado'
        : 'Não conectado',
      connected: whatsapp.alreadyConnected,
      brand: 'whatsapp',
      connectKind: 'whatsapp',
      moduleHref: `/app/${orgSlug}/conversas`,
      manageHref: `${base}/whatsapp`,
    },
    {
      id: 'instagram',
      title: 'Instagram',
      category: 'Social',
      description: 'DMs, comentários e automações de resposta. Login, gestão de contas ativas e regras ficam dentro do módulo Instagram.',
      meta: instagramConnections.length > 0
        ? `${instagramConnections.length} conta${instagramConnections.length > 1 ? 's' : ''} conectada${instagramConnections.length > 1 ? 's' : ''}`
        : 'Não conectado',
      connected: instagramConnections.length > 0,
      brand: 'instagram',
      connectKind: 'instagram',
      moduleHref: `/app/${orgSlug}/conversas`,
      manageHref: `${base}/social`,
    },
    {
      id: 'tiktok',
      title: 'TikTok',
      category: 'Social',
      description: 'Gestão de mensagens diretas e automações de comentário — mesma lógica do Instagram, adaptada à API do TikTok.',
      meta: 'Na fila de desenvolvimento',
      connected: false,
      comingSoon: true,
      brand: 'tiktok',
    },
    {
      id: 'google-business',
      title: 'Google Business Profile',
      category: 'Reputação',
      description: 'Puxe e responda avaliações do Google diretamente do CRM, sem sair do Althos.',
      meta: googleConnections.length > 0 ? `${googleConnections.length} conta conectada` : 'Não conectado',
      connected: googleConnections.length > 0,
      brand: 'google',
      manageHref: `${base}/google-business`,
    },
    {
      id: 'asaas',
      title: 'Asaas',
      category: 'Pagamentos',
      description: 'Cobranças, assinaturas e conciliação financeira integradas ao módulo Financeiro.',
      meta: (org as any).asaas_customer_id ? 'Conectado' : 'Não conectado',
      connected: !!(org as any).asaas_customer_id,
      brand: 'asaas',
      moduleHref: `/app/${orgSlug}/financeiro`,
    },
    {
      id: 'agente-ia',
      title: 'Agente IA',
      category: 'Automação',
      description: 'Atendimento automático e qualificação de leads (score 0–100, tier, tags) no WhatsApp.',
      meta: 'Configurável',
      connected: true,
      brand: 'ai',
      manageHref: `${base}/agente-ia`,
    },
    {
      id: 'resend',
      title: 'E-mail (Resend)',
      category: 'Comunicação',
      description: 'Envie automações e campanhas de e-mail com seu próprio domínio.',
      meta: 'Configurável',
      connected: false,
      brand: 'email',
      manageHref: `${base}/email-creditos`,
    },
    {
      id: 'autentique',
      title: 'Autentique',
      category: 'Documentos',
      description: 'Assinatura digital de contratos — cada conta usa sua própria chave de API.',
      meta: 'Configurável',
      connected: false,
      brand: 'sign',
      manageHref: `${base}/autentique`,
    },
  ]

  return <IntegrationsGrid orgSlug={orgSlug} items={items} />
}
