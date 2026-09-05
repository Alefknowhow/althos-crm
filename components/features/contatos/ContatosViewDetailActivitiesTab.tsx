'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'
import SendEmailDialog from '@/components/features/SendEmailDialog'
import SendCustomEmailDialog from '@/components/features/SendCustomEmailDialog'
import TaskCard from '@/components/features/TaskCard'
import { fmtCurrency, fmtDate, type Selected } from './ContatosViewShared'
import { ActivityRow } from './ContatosViewDetailHelpers'

export function ActivitiesTab({
  orgSlug, selected, c, orgName, onNewTask,
}: {
  orgSlug:     string
  selected:    NonNullable<Selected>
  c:           NonNullable<Selected>['contato']
  orgName:     string
  onNewTask:   () => void
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
      <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
        <div className="flex items-center justify-between">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Tarefas</p>
          <Button type="button" size="sm" variant="outline" onClick={onNewTask}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Nova tarefa
          </Button>
        </div>
        {selected.tasks.length > 0 ? (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {selected.tasks.map((task: any) => (
              <TaskCard key={task.id} task={task} orgSlug={orgSlug} />
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhuma tarefa vinculada.</p>
        )}
      </div>

      <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">E-mails</p>
          {/* Sempre visíveis — sem e-mail cadastrado, os próprios
              diálogos avisam "Sem e-mail" e desabilitam o envio, em
              vez de esconder o botão inteiro. */}
          <div className="flex items-center gap-1.5 shrink-0">
            <SendEmailDialog
              orgSlug={orgSlug}
              lead={c}
              templates={selected.templates}
              org={{ name: orgName }}
              trigger={<Button type="button" size="sm" variant="outline">Disparar template</Button>}
            />
            <SendCustomEmailDialog
              orgSlug={orgSlug}
              lead={c}
              trigger={<Button type="button" size="sm" variant="outline">Enviar e-mail</Button>}
            />
          </div>
        </div>
        {selected.emailSends.length > 0 ? (
          <div className="max-h-[420px] overflow-y-auto border rounded-lg divide-y">
            {selected.emailSends.map((es: any) => (
              <div key={es.id} className="flex justify-between items-center px-3 py-2.5">
                <div>
                  <div className="text-sm font-medium">{(Array.isArray(es.email_templates) ? es.email_templates[0]?.name : es.email_templates?.name) || 'E-mail avulso'}</div>
                  <div className="text-[11px] text-muted-foreground">{new Date(es.created_at).toLocaleString('pt-BR')}</div>
                </div>
                <Badge variant={es.status === 'sent' ? 'default' : es.status === 'opened' ? 'secondary' : es.status === 'failed' || es.status === 'bounced' ? 'destructive' : 'outline'}>{es.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhum e-mail enviado.</p>
        )}
      </div>

      <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">WhatsApp</p>
        {selected.whatsappConv ? (
          <div className="text-sm border rounded-lg p-3 bg-muted/20 flex flex-col items-center justify-center text-center gap-1.5">
            <div className="font-semibold">{selected.whatsappConv.contact_name || selected.whatsappConv.contact_phone}</div>
            <div className="text-muted-foreground text-xs">{selected.whatsappConv.contact_phone}</div>
            <div className="text-[11px] mt-1 bg-primary/10 text-primary px-2 py-1 rounded-full">
              Última interação: {fmtDate(selected.whatsappConv.last_message_at)}
            </div>
            <Link href={`/app/${orgSlug}/conversas?id=${selected.whatsappConv.id}`} className="flex w-full">
              <Button className="w-full bg-[#25D366] hover:bg-[#1DA851] text-white">Abrir Conversa WhatsApp</Button>
            </Link>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Sem conversa vinculada.</p>
        )}
      </div>

      <div className="border rounded-lg p-3 space-y-3 min-h-[220px] flex flex-col">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Timeline</p>
        {selected.activities.length > 0 ? (
          <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
            {selected.activities.map((act: any) => <ActivityRow key={act.id} act={act} fmtCurrency={fmtCurrency} />)}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4 border rounded-lg flex-1 flex items-center justify-center">Nenhuma atividade registrada.</p>
        )}
      </div>
    </div>
  )
}
