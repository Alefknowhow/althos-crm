'use client'

import { cn } from '@/lib/utils'
import type { ContatoDeal } from '@/actions/contatos'

export function ActivityRow({ act, fmtCurrency }: { act: any; fmtCurrency: (v: number) => string }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs">
        {act.type === 'manual_created' ? '🚀' : act.type === 'note' ? '📝' : act.type === 'ai_qualified' ? '✨' : act.type.startsWith('email') ? '✉️' : act.type.startsWith('credit_') ? '🎫' : '⚙️'}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium">
          {act.type === 'manual_created' ? 'Contato criado manualmente'
            : act.type === 'note' ? 'Nota adicionada'
            : act.type === 'ai_qualified' ? `IA qualificou: ${act.payload?.tier?.toUpperCase()} (${act.payload?.score}/100)`
            : act.type === 'email_sent' ? 'E-mail enviado'
            : act.type === 'email_opened' ? 'E-mail aberto'
            : act.type === 'credit_created' ? `Crédito de cancelamento gerado: ${fmtCurrency(act.payload?.valor_cents || 0)} (${act.payload?.operadora})`
            : act.type === 'credit_used' ? `Crédito de cancelamento utilizado: ${fmtCurrency(act.payload?.valor_cents || 0)}`
            : act.type}
        </div>
        {act.type === 'note' && <div className="text-sm mt-1 whitespace-pre-wrap">{act.payload.text}</div>}
        {act.type === 'ai_qualified' && (
          <div className="text-xs mt-1 text-muted-foreground italic">
            {act.payload?.reason}
            {act.payload?.concerns?.length > 0 && <div className="mt-1">⚠ {act.payload.concerns.join(' · ')}</div>}
          </div>
        )}
        {act.type === 'email_sent' && <div className="text-xs mt-1 text-muted-foreground">Assunto: {act.payload.subject} (Template: {act.payload.template_name})</div>}
        <div className="text-[11px] text-muted-foreground mt-1">{new Date(act.created_at).toLocaleString('pt-BR')}</div>
      </div>
    </div>
  )
}

export function DealCard({ d, fmtCurrency, fmtDate }: { d: ContatoDeal; fmtCurrency: (v: number) => string; fmtDate: (v: string | null) => string }) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
      <div className="min-w-0">
        <span className={cn(
          'font-medium',
          d.status === 'won' && 'text-emerald-600',
          d.status === 'lost' && 'text-muted-foreground',
        )}>
          {d.status === 'won' ? 'Ganho' : d.status === 'lost' ? 'Perdido' : 'Em aberto'}
        </span>
        {d.stage_name && <span className="text-muted-foreground"> · {d.stage_name}</span>}
        <div className="text-xs text-muted-foreground">
          {fmtDate(d.won_at || d.lost_at || d.created_at)}
        </div>
      </div>
      <span className="font-semibold tabular-nums shrink-0">{fmtCurrency(d.value_cents || 0)}</span>
    </div>
  )
}

export function Field({ icon: Icon, label, children, dense }: { icon: any; label: string; children: React.ReactNode; dense?: boolean }) {
  return (
    <div className={cn('rounded-lg border bg-background space-y-1', dense ? 'p-2' : 'p-3')}>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className={dense ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        <span className={cn('font-bold uppercase tracking-wider', dense ? 'text-[9px]' : 'text-[10px]')}>{label}</span>
      </div>
      {children}
    </div>
  )
}
