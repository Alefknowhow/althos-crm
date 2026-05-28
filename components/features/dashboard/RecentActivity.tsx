import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  MessageSquare,
  Phone,
  Mail,
  UserPlus,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

interface Activity {
  id: string
  type: string
  created_at: string
  payload: any
  leads: {
    id: string
    name: string
  } | null
}

interface RecentActivityProps {
  activities: Activity[]
}

const ACTIVITY_META: Record<string, { icon: LucideIcon; label: string; tone: string }> = {
  lead_created:    { icon: UserPlus,      label: 'Novo lead',           tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  whatsapp_message:{ icon: MessageSquare, label: 'Mensagem WhatsApp',   tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  call:            { icon: Phone,         label: 'Ligação',             tone: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  email:           { icon: Mail,          label: 'E-mail',              tone: 'text-blue-600 dark:text-blue-400 bg-blue-500/10' },
  stage_changed:   { icon: RefreshCw,     label: 'Mudança de etapa',    tone: 'text-orange-600 dark:text-orange-400 bg-orange-500/10' },
  task_completed:  { icon: CheckCircle2,  label: 'Tarefa concluída',    tone: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
}

const FALLBACK_META = { icon: AlertCircle, label: 'Atividade', tone: 'text-muted-foreground bg-secondary' }

export default function RecentActivity({ activities }: RecentActivityProps) {
  return (
    <Card className="reveal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Atividade recente</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3.5">
          {activities.length > 0 ? (
            activities.map(activity => {
              const meta = ACTIVITY_META[activity.type] ?? FALLBACK_META
              const Icon = meta.icon
              return (
                <div key={activity.id} className="flex items-start gap-3 text-sm">
                  <div className={`mt-0.5 p-1.5 rounded-full shrink-0 ${meta.tone}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="leading-snug truncate tracking-apple-snug">
                      <span className="font-medium text-foreground">{meta.label}</span>
                      {' em '}
                      <span className="font-medium text-foreground">
                        {activity.leads?.name || 'Lead removido'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground tracking-apple-snug">
                      há {formatDistanceToNow(new Date(activity.created_at), { locale: ptBR })}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="text-sm text-muted-foreground py-10 text-center tracking-apple-snug">
              Nenhuma atividade recente.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
