import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listOrgNumbers, getVoiceCreditsStatusAction, listVoiceLedger, getVoiceAccountSettings } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Hash } from 'lucide-react'
import { VoiceNumbersClient } from '@/components/features/voice/VoiceNumbersClient'
import { VoiceBuyCreditsButton } from '@/components/features/voice/VoiceBuyCreditsButton'
import { VoiceSettingsForm } from '@/components/features/voice/VoiceSettingsForm'
import { VoiceActivationCard } from '@/components/features/voice/VoiceActivationCard'

export const dynamic = 'force-dynamic'

function formatCents(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const TYPE_LABELS: Record<string, string> = {
  purchased: 'Compra de créditos', consumed: 'Consumo', refunded: 'Estorno',
}
const USAGE_LABELS: Record<string, string> = {
  call_human: 'Ligação', call_ai: 'Voice AI', sms: 'SMS', number_rental: 'Número',
}

export default async function VoiceContaPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams?: { tab?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const [numbersRes, statusRes, ledgerRes, settingsRes] = await Promise.all([
    listOrgNumbers(params.orgSlug),
    getVoiceCreditsStatusAction(params.orgSlug),
    listVoiceLedger(params.orgSlug),
    getVoiceAccountSettings(params.orgSlug),
  ])
  const numbers = numbersRes.ok ? numbersRes.numbers : []
  const status = statusRes.ok ? statusRes.status : null
  const transactions = ledgerRes.ok ? ledgerRes.transactions : []
  const account = settingsRes.ok ? settingsRes.account : null
  const isActive = account?.status === 'active'
  const initialTab = ['numeros', 'creditos', 'configuracoes'].includes(searchParams?.tab || '') ? searchParams!.tab! : 'numeros'

  return (
    <div className="space-y-6">
      <PageHeader title="Conta" hint="Números, créditos e configurações do Althos Voice." />

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="numeros">Números</TabsTrigger>
          <TabsTrigger value="creditos">Créditos</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="numeros" className="space-y-6 max-w-3xl">
          {numbers.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center space-y-3">
                <Hash className="w-10 h-10 mx-auto opacity-40" />
                <p className="text-sm text-muted-foreground">Nenhum número configurado ainda. Compre um número para começar a ligar e receber chamadas.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-none border divide-y">
              {numbers.map((n: any) => (
                <div key={n.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{n.e164_number}</div>
                    <div className="text-xs text-muted-foreground">
                      {n.capabilities?.voice && 'Voz'}{n.capabilities?.voice && n.capabilities?.sms && ' · '}{n.capabilities?.sms && 'SMS'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <VoiceNumbersClient orgSlug={params.orgSlug} />
        </TabsContent>

        <TabsContent value="creditos" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Saldo</CardTitle>
              <VoiceBuyCreditsButton orgSlug={params.orgSlug} />
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <div className="text-xs text-muted-foreground">Saldo disponível</div>
                <div className="text-2xl font-semibold">{formatCents(status?.availableCents)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Consumo este mês</div>
                <div className="text-lg font-medium">{formatCents(status?.usedCents)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comprado este mês</div>
                <div className="text-lg font-medium">{formatCents(status?.purchasedCents)}</div>
              </div>
            </CardContent>
          </Card>

          <div>
            <h3 className="text-sm font-medium mb-2">Histórico</h3>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma transação ainda.</p>
            ) : (
              <div className="overflow-auto max-h-[500px] rounded-none border">
                <table className="w-full caption-bottom text-sm">
                  <TableHeader className="sticky top-0 z-10 bg-card">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Uso</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead className="text-right">Saldo após</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString('pt-BR')}</TableCell>
                        <TableCell>{TYPE_LABELS[t.type] || t.type}</TableCell>
                        <TableCell className="text-muted-foreground">{t.usage_type ? (USAGE_LABELS[t.usage_type] || t.usage_type) : '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCents(t.althos_cost_cents)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCents(t.balance_after_cents)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="configuracoes">
          {isActive ? (
            <VoiceSettingsForm
              orgSlug={params.orgSlug}
              initialRecordingPolicy={account?.recording_policy || 'off'}
              initialLimits={account?.limits || {}}
            />
          ) : (
            <VoiceActivationCard orgSlug={params.orgSlug} />
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
