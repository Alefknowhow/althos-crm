import {
  KanbanSquare, Bot, Workflow, MessageCircle, BarChart3, CalendarClock,
  Users, FileInput, Plane, Home, Stethoscope, Car, Megaphone, Store,
  Sparkles, Rocket, Puzzle, HeartHandshake, ShieldCheck, Wallet,
  type LucideIcon,
} from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  KanbanSquare, Bot, Workflow, MessageCircle, BarChart3, CalendarClock,
  Users, FileInput, Plane, Home, Stethoscope, Car, Megaphone, Store,
  Sparkles, Rocket, Puzzle, HeartHandshake, ShieldCheck, Wallet,
}

/** Renderiza um ícone lucide pelo nome (usado pelos dados em lib/site/content.ts). */
export function SiteIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles
  return <Icon className={className} />
}
