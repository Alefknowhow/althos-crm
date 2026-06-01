import { getLatestHealth, getAvailability, type LatestHealthRow, type AvailabilityPoint } from '@/actions/health'
import type { HealthStatus, IntegrationName } from '@/lib/health/checks'
import { Card } from '@/components/ui/card'
import RefreshButton from './RefreshButton'
import {
  MessageSquare, Mail, Workflow, Database,
  CheckCircle2, XCircle, MinusCircle, Activity,
} from 'lucide-react'

export const dynamic = 'force-dynamic'

// --- Presentation maps ------------------------------------------------------

const INTEGRATION_META: Record<IntegrationName, { label: string; icon: any }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare },
  email:    { label: 'Email (Resend)', icon: Mail },
  inngest:  { label: 'Automações (Inngest)', icon: Workflow },
  supabase: { label: 'Banco & Storage (Supabase)', icon: Database },
}

const STATUS_META: Record<HealthStatus, { label: string; dot: string; text: string; ring: string }> = {
  healthy:      { label: 'Saudável',     dot: 'bg-emerald-500', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  warning:      { label: 'Atenção',      dot: 'bg-amber-500',   text: 'text-amber-700',   ring: 'ring-amber-200' },
  error:        { label: 'Erro',         dot: 'bg-red-500',     text: 'text-red-700',     ring: 'ring-red-200' },
  disconnected: { label: 'Desconectado', dot: 'bg-gray-400',    text: 'text-gray-600',    ring: 'ring-gray-200' },
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'agora mesmo'
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} d`
}

// 30-day availability strip for one integration.
function AvailabilityStrip({ points }: { points: AvailabilityPoint[] }) {
  // Map day(YYYY-MM-DD) → uptimePct.
  const byDay = new Map(points.map(p => [p.day, p.uptimePct]))
  const cells: Array<{ day: string; pct: number | null }> = []
  const today = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ day: key, pct: byDay.has(key) ? byDay.get(key)! : null })
  }

  const color = (pct: number | null) => {
    if (pct === null) return 'bg-gray-200'
    if (pct >= 99) return 'bg-emerald-500'
    if (pct >= 90) return 'bg-amber-400'
    if (pct > 0) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const known = cells.filter(c => c.pct !== null)
  const avg = known.length ? Math.round((known.reduce((s, c) => s + (c.pct as number), 0) / known.length) * 10) / 10 : null

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">Disponibilidade (30 dias)</span>
        <span className="text-xs font-medium">{avg === null ? '—' : `${avg}%`}</span>
      </div>
      <div className="flex gap-[2px]">
        {cells.map(c => (
          <div
            key={c.day}
            title={`${c.day}: ${c.pct === null ? 'sem dados' : c.pct + '%'}`}
            className={`h-6 flex-1 rounded-sm ${color(c.pct)}`}
          />
        ))}
      </div>
    </div>
  )
}

function CheckIcon({ ok }: { ok: boolean | null }) {
  if (ok === true) return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  if (ok === false) return <XCircle className="h-4 w-4 text-red-500 shrink-0" />
  return <MinusCircle className="h-4 w-4 text-gray-400 shrink-0" />
}

function IntegrationCard({
  row,
  points,
}: {
  row: LatestHealthRow
  points: AvailabilityPoint[]
}) {
  const meta = INTEGRATION_META[row.integration]
  const st = STATUS_META[row.status]
  const Icon = meta.icon

  return (
    <Card className={`p-5 ring-1 ${st.ring}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{meta.label}</h3>
            <p className={`text-sm ${st.text}`}>{row.summary}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`h-2.5 w-2.5 rounded-full ${st.dot}`} />
          <span className={`text-xs font-medium ${st.text}`}>{st.label}</span>
        </div>
      </div>

      <ul className="space-y-1.5 mb-4">
        {row.details.map((d, i) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <CheckIcon ok={d.ok} />
            <span className="text-foreground">{d.label}</span>
            {d.message && <span className="text-muted-foreground">— {d.message}</span>}
          </li>
        ))}
      </ul>

      <AvailabilityStrip points={points} />

      <p className="text-xs text-muted-foreground mt-3">
        Última verificação {relTime(row.checkedAt)}
      </p>
    </Card>
  )
}

export default async function IntegrationsHealthPage({ params }: { params: { orgSlug: string } }) {
  const [latest, availability] = await Promise.all([
    getLatestHealth(params.orgSlug),
    getAvailability(params.orgSlug, 30),
  ])

  const pointsByIntegration = (name: IntegrationName) =>
    availability.filter(p => p.integration === name)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Saúde das Integrações
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Estado de WhatsApp, Email, Automações e Banco de Dados. Atualizado automaticamente a cada 15 minutos.
          </p>
        </div>
        <RefreshButton orgSlug={params.orgSlug} />
      </div>

      {latest.length === 0 ? (
        <Card className="p-10 text-center">
          <Activity className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Nenhuma verificação ainda</p>
          <p className="text-sm text-muted-foreground mb-4">
            Execute a primeira verificação para ver o estado das suas integrações.
          </p>
          <div className="flex justify-center">
            <RefreshButton orgSlug={params.orgSlug} />
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {latest.map(row => (
            <IntegrationCard
              key={row.integration}
              row={row}
              points={pointsByIntegration(row.integration)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
