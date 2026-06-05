import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Activity, Share2, Sparkles, AtSign } from 'lucide-react'
import SettingsTabsNav from '../SettingsTabsNav'

export default function IntegracoesPage({ params }: { params: { orgSlug: string } }) {
  const base = `/app/${params.orgSlug}/configuracoes`

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <div className="space-y-4">
        {/* Saúde das integrações */}
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center gap-4 pb-2">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">Saúde das Integrações</CardTitle>
              <CardDescription>Diagnóstico em tempo real de todas as conexões.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              WhatsApp, Email, Automações e Banco de Dados — status, último erro e disponibilidade dos últimos 30 dias.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <a href={`${base}/integracoes/saude`}>Ver painel de saúde</a>
            </Button>
          </CardFooter>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center text-green-600">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp Cloud API</CardTitle>
                <CardDescription>Conecte seu número oficial.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Envie e receba mensagens diretamente no CRM.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={`${base}/whatsapp`}>Configurar</a>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <Share2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Resend (Email)</CardTitle>
                <CardDescription>Configure seu domínio de e-mail.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Envie automações de e-mail com seu domínio.</p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full">Conectar</Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">IA Qualificadora</CardTitle>
                <CardDescription>Score automático de leads com Claude.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Cada lead recém-capturado é avaliado pela IA: score 0–100, tier (hot/warm/cold), tags e razões.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={`${base}/ia`}>Configurar</a>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center text-white"
                style={{ background: 'linear-gradient(135deg, #f09433, #dc2743 50%, #bc1888)' }}
              >
                <AtSign className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Instagram · DMs & Comentários</CardTitle>
                <CardDescription>Auto-resposta de DMs e comentários.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Conecte uma conta profissional e automatize respostas com IA.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={`${base}/social`}>Configurar</a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
