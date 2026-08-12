import { requireAuth } from '@/lib/supabase/types'
import { notFound } from 'next/navigation'
import { getCampaignDetail } from '@/actions/send-campaigns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import CampaignDetailActions, { ResendRecipient } from '@/components/features/campaigns/CampaignDetailActions'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Rascunho',  className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  scheduled: { label: 'Agendada',  className: 'bg-blue-100 text-blue-800 border-blue-200' },
  sending:   { label: 'Enviando',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  canceled:  { label: 'Cancelada', className: 'bg-red-100 text-red-800 border-red-200' },
}

const RECIPIENT_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  sending: { label: 'Enviando', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  sent:    { label: 'Enviado',  className: 'bg-green-100 text-green-800 border-green-200' },
  failed:  { label: 'Falhou',   className: 'bg-red-100 text-red-800 border-red-200' },
  skipped: { label: 'Ignorado', className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
}

export default async function CampanhaDetailPage({ params }: { params: { orgSlug: string; id: string } }) {
  await requireAuth()
  const detail = await getCampaignDetail(params.orgSlug, params.id)
  if (!detail) notFound()

  const { campaign, recipients } = detail
  const status = STATUS_LABEL[campaign.status] || STATUS_LABEL.draft

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold">{campaign.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={status.className} variant="outline">{status.label}</Badge>
            <span className="text-sm text-muted-foreground">
              {campaign.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
            </span>
          </div>
        </div>
        <CampaignDetailActions orgSlug={params.orgSlug} campaign={campaign} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="border rounded-none p-4 text-center">
          <p className="text-2xl font-semibold">{campaign.recipient_count}</p>
          <p className="text-xs text-muted-foreground">Destinatários</p>
        </div>
        <div className="border rounded-none p-4 text-center">
          <p className="text-2xl font-semibold text-green-700">{campaign.sent_count}</p>
          <p className="text-xs text-muted-foreground">Enviados</p>
        </div>
        <div className="border rounded-none p-4 text-center">
          <p className="text-2xl font-semibold text-red-700">{campaign.failed_count}</p>
          <p className="text-xs text-muted-foreground">Falhas</p>
        </div>
      </div>

      <div className="bg-card border rounded-none overflow-hidden">
        {recipients.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detalhe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recipients.map(r => {
                const rStatus = RECIPIENT_STATUS_LABEL[r.status] || RECIPIENT_STATUS_LABEL.pending
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.contact_name || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {campaign.channel === 'whatsapp' ? (r.contact_phone || '—') : (r.contact_email || '—')}
                    </TableCell>
                    <TableCell>
                      <Badge className={rStatus.className} variant="outline">{rStatus.label}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.status === 'skipped' && 'Sem contato para o canal'}
                      {r.status === 'failed' && (r.error || 'Erro no envio')}
                      {r.status === 'failed' && (
                        <ResendRecipient orgSlug={params.orgSlug} recipientId={r.id} />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground bg-muted/10">
            Nenhum destinatário ainda.
          </div>
        )}
      </div>
    </div>
  )
}
