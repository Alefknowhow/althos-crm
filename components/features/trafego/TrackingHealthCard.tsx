'use client'

/**
 * Card "Saúde do tracking" (#27/#61 2.4) — usado tanto no Portal (só
 * flags/datas, sem segredo) quanto no painel interno (que recebe também
 * `recentFailures`, com mensagem de erro, via prop opcional).
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TrackingHealthData = {
  metaPixelConfigured: boolean
  lastCapiSendAt: string | null
  capiFailures7d: number
  googleAdsConfigured: boolean
  activeTrackingLinks: number
  lastClickAt: string | null
  lastAccountSyncAt: string | null
  lastAccountSyncDaysAgo: number | null
  alerts: { severity: 'atencao' | 'critico'; title: string; reason: string }[]
}

function fmtDate(iso: string | null) {
  if (!iso) return 'nunca'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-2 text-sm border-b last:border-0">
      <div className="flex items-center gap-2">
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-muted-foreground" />}
        <span className="font-medium">{label}</span>
      </div>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  )
}

export default function TrackingHealthCard({
  health, recentFailures,
}: {
  health: TrackingHealthData
  recentFailures?: { createdAt: string; eventName: string; error: string | null }[]
}) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Saúde do tracking</CardTitle></CardHeader>
      <CardContent className="space-y-1">
        <StatusRow ok={health.metaPixelConfigured} label="Meta Pixel / CAPI" detail={health.metaPixelConfigured ? `Último envio: ${fmtDate(health.lastCapiSendAt)}` : 'não configurado'} />
        {health.metaPixelConfigured && health.capiFailures7d > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-amber-700 pb-1">
            <AlertTriangle className="w-3.5 h-3.5" /> {health.capiFailures7d} falha{health.capiFailures7d !== 1 ? 's' : ''} de envio nos últimos 7 dias
          </div>
        )}
        <StatusRow ok={health.googleAdsConfigured} label="Google Ads conversions" detail={health.googleAdsConfigured ? 'configurado' : 'não configurado'} />
        <StatusRow ok={health.activeTrackingLinks > 0} label="Links de rastreamento" detail={`${health.activeTrackingLinks} ativo${health.activeTrackingLinks !== 1 ? 's' : ''} · último clique: ${fmtDate(health.lastClickAt)}`} />
        <StatusRow
          ok={health.lastAccountSyncDaysAgo != null && health.lastAccountSyncDaysAgo < 3}
          label="Sincronização de contas"
          detail={health.lastAccountSyncAt ? fmtDate(health.lastAccountSyncAt) : 'nunca sincronizado'}
        />

        {health.alerts.length > 0 && (
          <div className="pt-2 space-y-1.5">
            {health.alerts.map((a, i) => (
              <div key={i} className={cn('flex items-start gap-2 text-xs rounded-md border px-2.5 py-2', a.severity === 'critico' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800')}>
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <div><span className="font-medium">{a.title}.</span> {a.reason}</div>
              </div>
            ))}
          </div>
        )}

        {recentFailures && recentFailures.length > 0 && (
          <div className="pt-3 space-y-1.5">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Falhas recentes (CAPI)</div>
            {recentFailures.map((f, i) => (
              <div key={i} className="flex items-center justify-between text-xs rounded border bg-muted/30 px-2.5 py-1.5">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{f.eventName}</Badge>
                  <span className="text-muted-foreground truncate max-w-[280px]">{f.error || 'erro desconhecido'}</span>
                </span>
                <span className="text-muted-foreground shrink-0 ml-2">{fmtDate(f.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
