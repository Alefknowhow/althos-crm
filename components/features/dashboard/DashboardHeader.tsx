import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DashboardHeaderProps {
  userName: string
}

export default function DashboardHeader({ userName }: DashboardHeaderProps) {
  const hour = new Date().getHours()
  let greeting = 'Bom dia'
  if (hour >= 12 && hour < 18) greeting = 'Boa tarde'
  if (hour >= 18 || hour < 5) greeting = 'Boa noite'

  const dateStr = format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })

  return (
    <div className="flex flex-col gap-1.5 reveal">
      <h1 className="text-3xl md:text-4xl font-semibold tracking-apple-tight text-foreground">
        {greeting}, <span className="text-muted-foreground font-semibold">{userName}</span>
      </h1>
      <p className="text-base text-muted-foreground capitalize tracking-apple-snug">
        {dateStr}
      </p>
    </div>
  )
}
