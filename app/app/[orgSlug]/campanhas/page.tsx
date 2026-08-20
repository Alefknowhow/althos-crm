import { requireAuth } from '@/lib/supabase/types'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { Plus, MessageSquare, Mail } from 'lucide-react'
import { listCampaigns } from '@/actions/send-campaigns'

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft:     { label: 'Rascunho',  className: 'bg-muted text-muted-foreground border-muted-foreground/20' },
  scheduled: { label: 'Agendada',  className: 'bg-blue-100 text-blue-800 border-blue-200' },
  sending:   { label: 'Enviando',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
  completed: { label: 'Concluída', className: 'bg-green-100 text-green-800 border-green-200' },
  canceled:  { label: 'Cancelada', className: 'bg-red-100 text-red-800 border-red-200' },
}

export default async function CampanhasPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const campaigns = await listCampaigns(params.orgSlug)

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-end">
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/app/${params.orgSlug}/whatsapp-templates`}>
              <MessageSquare className="w-3.5 h-3.5" />
              Templates WhatsApp
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="gap-1.5">
            <Link href={`/app/${params.orgSlug}/email-templates`}>
              <Mail className="w-3.5 h-3.5" />
              Templates E-mail
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/app/${params.orgSlug}/campanhas/nova`}>
              <Plus className="w-4 h-4 mr-1.5" />
              Nova campanha
            </Link>
          </Button>
        </div>
      </div>

      <div className="bg-card border rounded-none overflow-hidden">
        {campaigns.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Progresso</TableHead>
                <TableHead>Criada em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map(c => {
                const status = STATUS_LABEL[c.status] || STATUS_LABEL.draft
                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Link href={`/app/${params.orgSlug}/campanhas/${c.id}`} className="font-medium hover:underline">
                        {c.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {c.channel === 'whatsapp' ? <MessageSquare className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                        {c.channel === 'whatsapp' ? 'WhatsApp' : 'E-mail'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.className} variant="outline">{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.recipient_count > 0 ? `${c.sent_count}/${c.recipient_count} enviados${c.failed_count ? ` · ${c.failed_count} falhas` : ''}` : '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground bg-muted/10">
            Nenhuma campanha criada ainda. Crie a primeira pra disparar uma mensagem em massa pro seu público.
          </div>
        )}
      </div>
    </div>
  )
}
