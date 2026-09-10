import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { checkFeatureAccessByOrgSlug } from '@/lib/plans/server'
import { VoicePaywall } from '@/components/features/voice/VoicePaywall'
import { listSMS } from '@/actions/voice'
import { PageHeader } from '@/components/ui/page-header'
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { MessageSquareText } from 'lucide-react'

export const dynamic = 'force-dynamic'

const STATUS_LABELS: Record<string, string> = {
  queued: 'Na fila', sent: 'Enviado', delivered: 'Entregue', failed: 'Falhou', received: 'Recebido',
}

export default async function VoiceSmsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)
  const allowed = await checkFeatureAccessByOrgSlug(params.orgSlug, 'voice')
  if (!allowed) return <VoicePaywall orgSlug={params.orgSlug} />

  const result = await listSMS(params.orgSlug)
  const messages = result.ok ? result.messages : []

  return (
    <div className="space-y-6">
      <PageHeader title="SMS" hint="Mensagens de texto enviadas e recebidas." />
      {messages.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground space-y-3">
          <MessageSquareText className="w-10 h-10 mx-auto opacity-40" />
          <p>Nenhum SMS ainda. Envie o primeiro a partir de um contato.</p>
        </div>
      ) : (
        <div className="overflow-auto max-h-[calc(100vh-220px)] rounded-none border">
          <table className="w-full caption-bottom text-sm">
            <TableHeader className="sticky top-0 z-10 bg-card">
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Direção</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map((m: any) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.contatos?.name || m.from_number}</TableCell>
                  <TableCell><Badge variant="outline">{m.direction === 'inbound' ? 'Recebido' : 'Enviado'}</Badge></TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">{m.body}</TableCell>
                  <TableCell>{STATUS_LABELS[m.status] || m.status}</TableCell>
                  <TableCell className="text-right tabular-nums">{((m.althos_cost_cents ?? 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </table>
        </div>
      )}
    </div>
  )
}
