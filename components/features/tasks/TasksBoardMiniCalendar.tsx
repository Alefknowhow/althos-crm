'use client'

/**
 * Calendário mensal compacto — só um seletor de data/período, sem nenhuma
 * informação de tarefa (sem pontos, sem popover, sem drag). A navegação de
 * mês/semana já vive no header do TasksBoardToolbar (prev/next + label);
 * este componente só desenha a grade e repassa o clique no dia.
 */

import { cn } from '@/lib/utils'
import { WEEKDAYS_PT, ymd } from './TasksBoardShared'

export function TasksBoardMiniCalendar({
  days, calMonth, todayYmd, selectedDay, onDayClick,
}: {
  days: Date[]
  calMonth: Date
  todayYmd: string
  selectedDay: string | null
  onDayClick: (d: string) => void
}) {
  return (
    <div className="rounded-[8px] border bg-card overflow-hidden">
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS_PT.map(w => (
          <div key={w} className="py-1.5 text-center text-[10px] font-medium text-muted-foreground">{w[0]}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 p-1.5">
        {days.map(d => {
          const key = ymd(d)
          const inMonth = d.getMonth() === calMonth.getMonth()
          const isToday = key === todayYmd
          const isSelected = selectedDay === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDayClick(key)}
              title={d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              className={cn(
                'mx-auto flex items-center justify-center w-7 h-7 rounded-full text-xs transition-colors',
                !inMonth && 'text-muted-foreground/40',
                inMonth && !isToday && !isSelected && 'text-foreground hover:bg-muted',
                isToday && !isSelected && 'bg-sky-100 dark:bg-sky-950/40 text-foreground font-semibold',
                isSelected && 'bg-primary text-primary-foreground font-semibold',
              )}
            >
              {d.getDate()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
