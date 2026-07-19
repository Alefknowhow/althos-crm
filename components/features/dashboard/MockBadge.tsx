import { FlaskConical } from 'lucide-react'

/** Selo discreto para métricas/gráficos sem fonte de dado real ainda —
 *  evita passar número fabricado como se fosse real pro usuário. */
export default function MockBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-muted-foreground/30 bg-muted/40 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
      <FlaskConical className="w-2.5 h-2.5" />
      Dado de exemplo
    </span>
  )
}
