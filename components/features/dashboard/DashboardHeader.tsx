interface DashboardHeaderProps {
  userName: string
}

const BRASILIA_TZ = 'America/Sao_Paulo'

export default function DashboardHeader({ userName }: DashboardHeaderProps) {
  const now = new Date()
  // Servidor roda em UTC (Vercel) — saudação e data precisam do horário de
  // Brasília, não do horário/data local do servidor.
  const hour = Number(
    new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hour12: false, timeZone: BRASILIA_TZ }).format(now),
  )
  let greeting = 'Bom dia'
  if (hour >= 12 && hour < 18) greeting = 'Boa tarde'
  if (hour >= 18 || hour < 5) greeting = 'Boa noite'

  const dateStr = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long', timeZone: BRASILIA_TZ,
  }).format(now)

  return (
    <div className="flex flex-col gap-0.5 sm:gap-1.5 reveal">
      <h1 className="text-lg sm:text-3xl md:text-4xl font-semibold tracking-apple-tight text-foreground truncate">
        {greeting}, <span className="text-muted-foreground font-semibold">{userName}</span>
      </h1>
      <p className="hidden sm:block text-base text-muted-foreground capitalize tracking-apple-snug">
        {dateStr}
      </p>
    </div>
  )
}
