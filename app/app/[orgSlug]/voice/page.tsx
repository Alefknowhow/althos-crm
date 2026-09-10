import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { getVoiceDashboardSummary } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Wallet } from 'lucide-react'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default async function VoiceDashboardPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const summary = await getVoiceDashboardSummary(params.orgSlug)
  if (!summary.ok) {
    return (
      <div className="max-w-3xl space-y-6">
        <PageHeader title="Althos Voice" />
        <Card><CardContent className="p-6 text-sm text-muted-foreground">{summary.error}</CardContent></Card>
      </div>
    )
  }

  const { today, credits } = summary
  const stats = [
    { label: 'Ligações hoje', value: today.total, icon: Phone },
    { label: 'Recebidas', value: today.inbound, icon: PhoneIncoming },
    { label: 'Realizadas', value: today.outbound, icon: PhoneOutgoing },
    { label: 'Não atendidas', value: today.missed, icon: PhoneMissed },
  ]

  return (
    <div className="space-y-6">
      <PageHeader title="Althos Voice" hint="Central de telefonia, SMS e Voice AI integrada ao CRM." />

      {today.total === 0 && (
        <Card>
          <CardContent className="p-10 text-center space-y-3">
            <Phone className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-sm text-muted-foreground">
              Nenhuma ligação realizada ainda. Faça sua primeira ligação diretamente de um contato.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s.icon className="w-3.5 h-3.5" /> {s.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Clock className="w-4 h-4" /> Tempo em ligação hoje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-semibold">{formatDuration(today.totalDurationSeconds)}</div>
            <p className="text-xs text-muted-foreground">Média: {formatDuration(today.avgDurationSeconds)} por ligação atendida</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-1.5"><Wallet className="w-4 h-4" /> Saldo Althos Voice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <div className="text-xl font-semibold">{formatCents(credits?.availableCents ?? 0)}</div>
            <p className="text-xs text-muted-foreground">Consumido este mês: {formatCents(credits?.usedCents ?? 0)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
