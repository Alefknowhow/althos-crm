import { Button } from '@/components/ui/button'
import { Activity, Share2, Sparkles, AtSign, Target } from 'lucide-react'
import SettingsTabsNav from '../SettingsTabsNav'

type IntegrationItem = {
  title: string
  description: string
  detail: string
  icon: typeof Activity
  iconClass?: string
  iconStyle?: React.CSSProperties
  actionLabel: string
  href?: string
  highlight?: boolean
}

export default function IntegracoesPage({ params }: { params: { orgSlug: string } }) {
  const base = `/app/${params.orgSlug}/configuracoes`

  const items: IntegrationItem[] = [
    {
      title: 'Saúde das Integrações',
      description: 'Diagnóstico em tempo real de todas as conexões.',
      detail: 'WhatsApp, Email, Automações e Banco de Dados — status, último erro e disponibilidade dos últimos 30 dias.',
      icon: Activity,
      iconClass: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
      actionLabel: 'Ver painel de saúde',
      href: `${base}/integracoes/saude`,
      highlight: true,
    },
    {
      title: 'WhatsApp Cloud API',
      description: 'Conecte seu número oficial.',
      detail: 'Envie e receba mensagens diretamente no CRM.',
      icon: Share2,
      iconClass: 'bg-green-100 text-green-600',
      actionLabel: 'Configurar',
      href: `${base}/whatsapp`,
    },
    {
      title: 'Resend (Email)',
      description: 'Configure seu domínio de e-mail.',
      detail: 'Envie automações de e-mail com seu domínio.',
      icon: Share2,
      iconClass: 'bg-red-100 text-red-600',
      actionLabel: 'Conectar',
    },
    {
      title: 'IA Qualificadora',
      description: 'Score automático de leads com Claude.',
      detail: 'Cada lead recém-capturado é avaliado pela IA: score 0–100, tier (hot/warm/cold), tags e razões.',
      icon: Sparkles,
      iconClass: 'bg-purple-100 text-purple-600',
      actionLabel: 'Configurar',
      href: `${base}/ia`,
    },
    {
      title: 'Capi / Pixel',
      description: 'Eventos de conversão para o Meta Ads.',
      detail: 'Configure o Pixel ID e o Access Token para enviar eventos de conversão ao Meta Ads, pelo navegador (Pixel) e pelo servidor (CAPI).',
      icon: Target,
      iconClass: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      actionLabel: 'Configurar',
      href: `${base}/meta`,
    },
    {
      title: 'Instagram · DMs & Comentários',
      description: 'Auto-resposta de DMs e comentários.',
      detail: 'Conecte uma conta profissional e automatize respostas com IA.',
      icon: AtSign,
      iconStyle: { background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)', color: '#fff' },
      actionLabel: 'Configurar',
      href: `${base}/social`,
    },
  ]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <div className="divide-y rounded-none border bg-card">
        {items.map(item => {
          const Icon = item.icon
          return (
            <div
              key={item.title}
              className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-center ${item.highlight ? 'bg-primary/[0.03]' : ''}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconClass || ''}`}
                style={item.iconStyle}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold">{item.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{item.description}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="shrink-0 sm:ml-4">
                {item.href ? (
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
                    <a href={item.href}>{item.actionLabel}</a>
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="w-full sm:w-auto">{item.actionLabel}</Button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
