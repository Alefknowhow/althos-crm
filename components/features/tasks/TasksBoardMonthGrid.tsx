'use client'

/**
 * Grade mensal em tela cheia, com chip de cada tarefa dentro do dia
 * (ponto colorido + horário + título) — visão "Calendário" do redesign
 * (guiada pelo anexo 1 do pedido). Substitui, no modo Calendário, o antigo
 * par "mini calendário (só datas) + lista ao lado": aqui o mês inteiro é a
 * tela, sem lista nenhuma ao lado.
 */

import { cn } from '@/lib/utils'
import {
  type Task, WEEKDAYS_PT, ymd, classify, dueTimeOnly,
} from './TasksBoardShared'

const MAX_CHIPS_PER_DAY = 3

function chipClass(task: Task): string {
  const g = classify(task)
  if (g === 'done') return 'bg-success/15 text-success'
  if (g === 'overdue') return 'bg-destructive/15 text-destructive'
  return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
}

function chipDotClass(task: Task): string {
  const g = classify(task)
  if (g === 'done') return 'bg-success'
  if (g === 'overdue') return 'bg-destructive'
  return 'bg-sky-500'
}

export function TasksBoardMonthGrid({
  days, calMonth, todayYmd, tasksByDate, onDayClick, onOpenTask,
}: {
  days: Date[]
  calMonth: Date
  todayYmd: string
  tasksByDate: Record<string, Task[]>
  /** Clique numa área vazia do dia — abre criação rápida naquela data. */
  onDayClick: (d: string) => void
  onOpenTask: (task: Task) => void
}) {
  return (
    <div className="rounded-[8px] border bg-card overflow-hidden flex flex-col h-full">
      <div className="grid grid-cols-7 border-b shrink-0">
        {WEEKDAYS_PT.map(w => (
          <div key={w} className="py-2 text-center text-xs font-medium text-muted-foreground">{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 min-h-0" style={{ gridTemplateRows: 'repeat(6, minmax(0, 1fr))' }}>
        {days.map(d => {
          const key = ymd(d)
          const inMonth = d.getMonth() === calMonth.getMonth()
          const isToday = key === todayYmd
          const dayTasks = tasksByDate[key] || []
          const overflow = dayTasks.length - MAX_CHIPS_PER_DAY

          return (
            <button
              type="button"
              key={key}
              onClick={() => onDayClick(key)}
              className={cn(
                'group flex flex-col items-stretch gap-1 border-b border-r p-1.5 text-left align-top min-h-[92px] transition-colors',
                'hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                !inMonth && 'bg-muted/20',
              )}
            >
              <span
                className={cn(
                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs shrink-0',
                  !inMonth && 'text-muted-foreground/40',
                  inMonth && !isToday && 'text-foreground',
                  isToday && 'bg-primary text-primary-foreground font-semibold',
                )}
              >
                {d.getDate()}
              </span>

              <div className="flex flex-col gap-0.5 min-w-0">
                {dayTasks.slice(0, MAX_CHIPS_PER_DAY).map(task => {
                  const time = dueTimeOnly(task.due_date)
                  return (
                    <span
                      key={task.id}
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); onOpenTask(task) }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onOpenTask(task) } }}
                      className={cn(
                        'flex items-center gap-1 rounded px-1 py-0.5 text-[10px] font-medium truncate cursor-pointer',
                        chipClass(task),
                      )}
                      title={task.title}
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', chipDotClass(task))} />
                      {time && <span className="tabular-nums shrink-0">{time}</span>}
                      <span className="truncate">{task.title}</span>
                    </span>
                  )
                })}
                {overflow > 0 && (
                  <span className="text-[10px] text-muted-foreground pl-1">+{overflow} mais</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Legenda — cores funcionais, ver stateDotClass/classify em TasksBoardShared.ts */}
      <div className="flex items-center gap-4 px-3 py-2 border-t text-xs text-muted-foreground shrink-0">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" /> Atrasada</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-sky-500" /> Agendada</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" /> Concluída</span>
      </div>
    </div>
  )
}
