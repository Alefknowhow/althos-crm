import Link from 'next/link'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listCalls } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_META: Record<string, { label: string; className: string }> = {
  queued: { label: 'Na fila', className: 'bg-muted text-muted-foreground border-border' },
  ringing: { label: 'Chamando', className: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  in_progress: { label: 'Em andamento', className: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'Concluída', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
  failed: { label: 'Falhou', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  no_answer: { label: 'Não atendida', className: 'bg-muted text-muted-foreground border-border' },
  canceled: { label: 'Cancelada', className: 'bg-muted text-muted-foreground border-border' },
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '—'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}

export default async function VoiceChamadasPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await listCalls(params.orgSlug)
  const calls = result.ok ? result.calls : []

  return (
    <div className="space-y-6">
      <PageHeader title="Chamadas" hint="Histórico completo de ligações humanas e de Voice AI." />

      {calls.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground space-y-3">
          <Phone className="w-10 h-10 mx-auto opacity-40" />
          <p>Nenhuma ligação realizada ainda. Faça sua primeira ligação diretamente de um contato.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-220px)] rounded-none border">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead>Número</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {calls.map((c: any) => {
                const meta = STATUS_META[c.status] || STATUS_META.queued
                return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">
                      <Link href={`/app/${params.orgSlug}/voice/chamadas/${c.id}`} className="hover:underline">
                        {c.contatos?.name || 'Número desconhecido'}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        {c.direction === 'inbound' ? <PhoneIncoming className="w-3.5 h-3.5" /> : <PhoneOutgoing className="w-3.5 h-3.5" />}
                        {c.direction === 'inbound' ? 'Recebida' : 'Realizada'}
                        {c.human_or_ai === 'ai' && <Badge variant="outline" className="ml-1 text-[10px]">Voice AI</Badge>}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.direction === 'inbound' ? c.from_number : c.to_number}</TableCell>
                    <TableCell>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${meta.className}`}>{meta.label}</span>
                    </TableCell>
                    <TableCell>{formatDuration(c.duration_seconds)}</TableCell>
                    <TableCell className="text-right tabular-nums">{((c.althos_cost_cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </table>
        </div>
      )}
    </div>
  )
}
