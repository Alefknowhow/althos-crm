import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { getVoiceAnalytics, listVoiceTeam } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VoiceTeamClient } from '@/components/features/voice/VoiceTeamClient'

export const dynamic = 'force-dynamic'

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default async function VoiceAnalyticsPage({ params }: { params: { orgSlug: string } }) {
  const user = await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const [result, teamResult] = await Promise.all([
    getVoiceAnalytics(params.orgSlug),
    listVoiceTeam(params.orgSlug),
  ])
  if (!result.ok) {
    return (
      <div className="space-y-6">
        <PageHeader title="Analytics & Equipe" />
        <p className="text-sm text-muted-foreground">{result.error}</p>
      </div>
    )
  }

  const { summary, byUser, byAgent, topObjections } = result
  const team = teamResult.ok ? teamResult.team : []

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics & Equipe" hint="Métricas dos últimos 30 dias e status ao vivo da equipe — coaching, não julgamento automático." />

      <Card>
        <CardHeader><CardTitle className="text-sm">Status da equipe agora</CardTitle></CardHeader>
        <CardContent>
          <VoiceTeamClient orgSlug={params.orgSlug} currentUserId={user.id} team={team} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total de ligações</p><p className="text-2xl font-semibold">{summary.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Taxa de atendimento</p><p className="text-2xl font-semibold">{summary.answerRate}%</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Duração média</p><p className="text-2xl font-semibold">{formatDuration(summary.avgDurationSeconds)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ligações atendidas</p><p className="text-2xl font-semibold">{summary.answered}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Por membro da equipe</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byUser.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : byUser
              .slice()
              .sort((a, b) => b.costCents - a.costCents)
              .map(u => (
                <div key={u.userId} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0 gap-3">
                  <span className="font-medium shrink-0">{u.name}</span>
                  <span className="text-muted-foreground text-xs text-right">
                    {u.calls} ligações · {u.answered} atendidas · {u.qualified} qualificações · {u.smsSent} SMS
                    <br />
                    custo total {(u.costCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Por agente de IA</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {byAgent.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : byAgent.map(a => (
              <div key={a.agentId} className="flex items-center justify-between text-sm border-b pb-1.5 last:border-0">
                <span className="font-medium">{a.name}</span>
                <span className="text-muted-foreground text-xs">
                  {a.calls} ligações · {a.qualified} qualificados · custo {(a.costCents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  {a.qualified > 0 && ` · ${((a.costCents / 100) / a.qualified).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/qualificado`}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Objeções mais frequentes</CardTitle></CardHeader>
        <CardContent>
          {topObjections.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados ainda.</p> : (
            <ol className="space-y-1.5 text-sm list-decimal list-inside">
              {topObjections.map(o => <li key={o.label}>{o.label} — {o.count}x</li>)}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
