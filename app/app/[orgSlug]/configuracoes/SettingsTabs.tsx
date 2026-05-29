'use client'

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Building, Users, Palette, Share2, Sparkles, Bot } from 'lucide-react'
import AppearanceTab from '@/components/features/AppearanceTab'

interface Props {
  orgSlug:        string
  orgId:          string
  initialLogoUrl: string | null
  initialColor:   string | null
}

export default function SettingsTabs({ orgSlug, orgId, initialLogoUrl, initialColor }: Props) {
  return (
    <Tabs defaultValue="geral" className="space-y-4">
      <TabsList>
        <TabsTrigger value="geral" className="gap-2">
          <Building className="w-4 h-4" /> Geral
        </TabsTrigger>
        <TabsTrigger value="membros" className="gap-2">
          <Users className="w-4 h-4" /> Membros
        </TabsTrigger>
        <TabsTrigger value="aparencia" className="gap-2">
          <Palette className="w-4 h-4" /> Aparência
        </TabsTrigger>
        <TabsTrigger value="integracoes" className="gap-2">
          <Share2 className="w-4 h-4" /> Integrações
        </TabsTrigger>
      </TabsList>

      {/* ── Geral ──────────────────────────────────────────────────────────── */}
      <TabsContent value="geral">
        <Card>
          <CardHeader>
            <CardTitle>Informações da Organização</CardTitle>
            <CardDescription>Atualize os dados básicos da sua empresa.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Organização</Label>
                <Input placeholder="Ex: Althos Performance" />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input disabled value={orgSlug} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Setor</Label>
              <Input placeholder="Marketing, Saúde, etc." />
            </div>
          </CardContent>
          <CardFooter>
            <Button>Salvar Alterações</Button>
          </CardFooter>
        </Card>
      </TabsContent>

      {/* ── Membros ────────────────────────────────────────────────────────── */}
      <TabsContent value="membros">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Membros da Equipe</CardTitle>
              <CardDescription>Convide seus colegas para colaborar no CRM.</CardDescription>
            </div>
            <Button size="sm">Convidar Membro</Button>
          </CardHeader>
          <CardContent>
            <div className="border rounded-md">
              <div className="p-4 flex items-center justify-between border-b last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">A</div>
                  <div>
                    <p className="text-sm font-medium">Alef (Você)</p>
                    <p className="text-xs text-muted-foreground">alef@althos.io</p>
                  </div>
                </div>
                <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded-full">Dono</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      {/* ── Aparência ──────────────────────────────────────────────────────── */}
      <TabsContent value="aparencia">
        <AppearanceTab
          orgSlug={orgSlug}
          orgId={orgId}
          initialLogoUrl={initialLogoUrl}
          initialColor={initialColor}
        />
      </TabsContent>

      {/* ── Integrações ────────────────────────────────────────────────────── */}
      <TabsContent value="integracoes">
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
                <a href={`/app/${orgSlug}/configuracoes/whatsapp`}>Configurar</a>
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
                <a href={`/app/${orgSlug}/configuracoes/ia`}>Configurar</a>
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-4 pb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base">Atendente IA</CardTitle>
                <CardDescription>Conversa autônoma no WhatsApp.</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                Persona, base de conhecimento, horário de atendimento e regras de escalação.
              </p>
            </CardContent>
            <CardFooter>
              <Button variant="outline" size="sm" className="w-full" asChild>
                <a href={`/app/${orgSlug}/configuracoes/atendente-ia`}>Configurar</a>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  )
}
