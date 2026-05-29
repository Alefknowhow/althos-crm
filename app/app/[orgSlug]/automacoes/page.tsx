import { Zap } from 'lucide-react'

export default function AutomacoesIndexPage() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-center p-8 text-muted-foreground">
      <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 opacity-30" />
      </div>
      <p className="text-base font-medium text-foreground/60">Selecione uma automação</p>
      <p className="text-sm mt-1 max-w-[260px] leading-relaxed">
        Escolha uma automação na lista ao lado ou crie uma nova.
      </p>
    </div>
  )
}
