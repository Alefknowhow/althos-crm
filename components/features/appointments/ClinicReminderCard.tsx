'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BellRing, ExternalLink } from 'lucide-react'
import { ensureClinicReminderTemplate, type ClinicReminderSettings } from '@/actions/clinic'

const STATUS_LABEL: Record<string, string> = {
  local: 'Rascunho — falta enviar para aprovação',
  pending: 'Aguardando aprovação da Meta',
  approved: 'Aprovado — lembretes ativos',
  rejected: 'Rejeitado pela Meta',
}
const STATUS_COLOR: Record<string, string> = {
  local: 'bg-muted text-muted-foreground',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800',
  approved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800',
  rejected: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800',
}

export default function ClinicReminderCard({
  orgSlug, settings, compact = false,
}: {
  orgSlug: string
  settings: ClinicReminderSettings
  /** Versão compacta (badge + botão, sem descrição) — usada ao lado das
   *  abas de Agendamentos em vez de ocupar uma linha inteira própria. */
  compact?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    setLoading(true)
    const res = await ensureClinicReminderTemplate(orgSlug)
    setLoading(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('Template de lembrete criado — envie para aprovação em Templates WhatsApp.')
    router.refresh()
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 shrink-0" title="Lembrete automático de agendamento (24h antes)">
        <BellRing className="w-3.5 h-3.5 text-muted-foreground shrink-0 hidden sm:block" />
        {settings.templateName ? (
          <>
            <Badge variant="outline" className={`text-[10px] ${STATUS_COLOR[settings.templateStatus || 'local']}`}>
              {STATUS_LABEL[settings.templateStatus || 'local']}
            </Badge>
            {settings.templateStatus !== 'approved' && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link href={`/app/${orgSlug}/whatsapp-templates`}>
                  Ver template <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            )}
          </>
        ) : (
          <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={loading}>
            {loading ? 'Criando...' : 'Criar lembrete automático'}
          </Button>
        )}
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="py-4 flex items-center gap-3 flex-wrap">
        <BellRing className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Lembrete automático de agendamento (24h antes)</p>
          <p className="text-xs text-muted-foreground">
            {settings.templateName
              ? 'Envia um WhatsApp de lembrete 24h antes de cada agendamento, automaticamente.'
              : 'Ainda não configurado — nenhum lembrete é enviado até criar o template.'}
          </p>
        </div>
        {settings.templateName ? (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className={STATUS_COLOR[settings.templateStatus || 'local']}>
              {STATUS_LABEL[settings.templateStatus || 'local']}
            </Badge>
            {settings.templateStatus !== 'approved' && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/app/${orgSlug}/whatsapp-templates`}>
                  Ver template <ExternalLink className="w-3 h-3 ml-1" />
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <Button size="sm" onClick={handleCreate} disabled={loading} className="shrink-0">
            {loading ? 'Criando...' : 'Criar template de lembrete'}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
