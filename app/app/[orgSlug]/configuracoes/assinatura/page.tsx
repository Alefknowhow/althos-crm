import { getCurrentOrganization } from '@/lib/supabase/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Check, Mail, MessageSquare, Users, Zap, ExternalLink } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { redirect } from 'next/navigation'

export default async function SubscriptionPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)

  if (org.account_type === 'internal') {
    redirect(`/app/${params.orgSlug}`)
  }

  const isManaged = org.account_type === 'althos_managed'
  const isTrial = org.subscription_status === 'trialing'
  
  // Calcular dias restantes de trial
  const daysRemaining = org.trial_ends_at 
    ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Assinatura e Plano</h1>
        <p className="text-muted-foreground">Gerencie o plano da sua organização e veja seus limites.</p>
      </div>

      {isManaged && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex gap-4 items-start text-blue-900">
              <Zap className="w-5 h-5 mt-1" />
              <div className="space-y-2">
                <p className="font-semibold">Plano Gerenciado pela Althos</p>
                <p className="text-sm">
                  Sua assinatura está inclusa no seu plano de serviços da Althos Performance. 
                  Para alterações de plano ou limites, entre em contato com seu gestor.
                </p>
                <Button variant="outline" className="mt-2 bg-white text-blue-600 border-blue-200 hover:bg-blue-50" asChild>
                  <a href="mailto:suporte@althos.io">Falar com Suporte</a>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Plano Atual</CardTitle>
            <CardDescription>Status e detalhes da sua conta</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Plano</span>
              <Badge variant="secondary" className="uppercase">{org.plan}</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Status</span>
              <Badge variant={org.subscription_status === 'active' ? 'default' : 'secondary'}>
                {org.subscription_status === 'active' ? 'Ativo' : isTrial ? 'Trialing' : org.subscription_status}
              </Badge>
            </div>
            
            {isTrial && (
              <div className="space-y-2 pt-2">
                <div className="flex justify-between text-xs">
                  <span>Período de teste</span>
                  <span>{daysRemaining} dias restantes</span>
                </div>
                <Progress value={(7 - daysRemaining) / 7 * 100} />
              </div>
            )}

            {!isManaged && org.subscription_status !== 'no_billing' && (
              <div className="pt-4 border-t space-y-2">
                <Button className="w-full" variant="default">
                  {isTrial ? 'Assinar Agora' : 'Trocar Plano'}
                </Button>
                <Button className="w-full" variant="outline">
                  Gerenciar no Asaas <ExternalLink className="w-3 h-3 ml-2" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Limites de Uso</CardTitle>
            <CardDescription>Capacidade mensal do seu plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Users className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="flex justify-between">
                  <span>Leads Totais</span>
                  <span className="font-medium">{org.limit_leads || '∞'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MessageSquare className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="flex justify-between">
                  <span>WhatsApp /mês</span>
                  <span className="font-medium">{org.limit_whatsapp_monthly || '∞'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="flex justify-between">
                  <span>E-mails /mês</span>
                  <span className="font-medium">{org.limit_email_monthly || '∞'}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1 text-sm">
                <div className="flex justify-between">
                  <span>Usuários</span>
                  <span className="font-medium">{org.limit_users || '∞'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {!isManaged && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Faturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground text-center py-8 border border-dashed rounded-lg">
              Nenhuma fatura encontrada.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
