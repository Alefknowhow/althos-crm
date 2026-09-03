import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { WidgetCtx } from '@/lib/dashboard/widget-registry'
import { getWhatsappAnalytics } from '@/actions/whatsapp-analytics'
import { sinceFromPeriod } from '@/lib/dashboard/period'
import KpiCard from '../KpiCard'
import WhatsAppHeatmap from '../WhatsAppHeatmap'
import WhatsAppDailyChartInner from '../WhatsAppDailyChartInner'

function fmtResponseTime(min: number | null): string {
  if (min === null) return '—'
  const totalSeconds = Math.round(min * 60)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}min`
  return s > 0 ? `${m}min ${s}s` : `${m}min`
}

/** Aba "WhatsApp" — analytics de atividade de conversas (somente leitura,
 *  não mexe no chat real nem no envio de mensagens). Reaproveita os mesmos
 *  filtros globais do dashboard (período via ctx.period, atendente via
 *  ctx.sellerId/SellerFilter no header). */
export default async function WhatsAppTab({ ctx }: { ctx: WidgetCtx }) {
  const since = sinceFromPeriod(ctx.period)
  const data = await getWhatsappAnalytics(ctx.orgId, since, ctx.sellerId)

  const totalMessages = data.totalInbound + data.totalOutbound

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
        <KpiCard
          label="Tempo médio de resposta"
          value={fmtResponseTime(data.avgResponseMinutes)}
          help="Tempo médio entre uma mensagem recebida e a próxima mensagem enviada na mesma conversa."
        />
        <KpiCard
          label="Taxa de resposta"
          value={data.responseRatePct !== null ? `${data.responseRatePct}%` : '—'}
          help="Percentual de mensagens recebidas que tiveram uma mensagem enviada depois, na mesma conversa."
        />
        <KpiCard
          label="Conversas iniciadas"
          value={String(data.conversationsStarted)}
          help="Conversas cuja primeira mensagem observada no período foi enviada pela agência."
        />
        <KpiCard
          label="Conversas recebidas"
          value={String(data.conversationsReceived)}
          help="Conversas cuja primeira mensagem observada no período foi enviada pelo cliente."
        />
        <KpiCard
          label="Conversas por atendente"
          value={data.avgConversationsPerAttendant !== null ? String(data.avgConversationsPerAttendant) : '—'}
          help="Média de conversas com atividade no período por atendente responsável (whatsapp_conversations.assigned_to)."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <Card className="h-[360px] flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base">Heatmap de horários</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Volume de mensagens (enviadas + recebidas) por hora do dia e dia da semana — {totalMessages} mensagem{totalMessages === 1 ? '' : 's'} no período.
            </p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-auto">
            <WhatsAppHeatmap cells={data.heatmap} />
          </CardContent>
        </Card>

        <Card className="h-[360px] flex flex-col">
          <CardHeader className="pb-2 shrink-0">
            <CardTitle className="text-base">Mensagens enviadas x recebidas</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Coluna empilhada = total do dia (recebidas + enviadas); linha = quantas enviadas foram respondidas pelo Agente IA.</p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            {data.daily.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem mensagens no período selecionado.</p>
            ) : (
              <WhatsAppDailyChartInner data={data.daily} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
