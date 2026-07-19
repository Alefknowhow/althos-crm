import { Sparkles } from 'lucide-react'
import MockBadge from '../MockBadge'

export default function MockInsightCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-muted-foreground/30 bg-muted/20 px-4 py-3">
      <Sparkles className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-sm flex-1">{text}</span>
      <MockBadge />
    </div>
  )
}
