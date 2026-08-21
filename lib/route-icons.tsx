'use client'

import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard, BarChart3, Kanban, Users, CheckSquare, FileSignature,
  PlaneTakeoff, Store, CalendarClock, Package, ShoppingCart, Receipt,
  FileStack, Calendar, MessageSquare, Megaphone, FileText, Wallet, Zap,
  Mail, Settings, HelpCircle, Send, Star, Stethoscope, ClipboardList, ListChecks, Hourglass, Percent, CalendarCheck2,
  Home, Handshake,
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { getRouteSegment } from '@/lib/route-titles'

/** lucide-react não tem ícone de Instagram (removido por licenciamento) —
 *  mesmo SVG inline usado no Sidebar. */
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

const ROUTE_ICONS: Record<string, LucideIcon | typeof InstagramGlyph> = {
  '': LayoutDashboard,
  relatorios: BarChart3,
  pipeline: Kanban,
  contatos: Users,
  tarefas: CheckSquare,
  cotacoes: FileSignature,
  roteirista: PlaneTakeoff,
  ofertas: Store,
  embarques: PlaneTakeoff,
  bloqueios: CalendarClock,
  catalogo: Package,
  vendas: ShoppingCart,
  reservas: Receipt,
  documentos: FileStack,
  agendamentos: Calendar,
  conversas: MessageSquare,
  social: InstagramGlyph,
  marketing: Megaphone,
  campanhas: Send,
  'whatsapp-templates': Send,
  forms: FileText,
  financeiro: Wallet,
  automacoes: Zap,
  'email-templates': Mail,
  configuracoes: Settings,
  ajuda: HelpCircle,
  avaliacoes: Star,
  profissionais: Stethoscope,
  orcamentos: FileSignature,
  atendimentos: ClipboardList,
  tratamentos: ListChecks,
  'lista-espera': Hourglass,
  comissoes: Percent,
  retornos: CalendarCheck2,
  imoveis: Home,
  propostas: FileSignature,
  negociacoes: Handshake,
}

/** Ícone da página atual, alinhado ao mesmo mapeamento de lib/route-titles.ts. */
export function PageIcon({ orgSlug, className }: { orgSlug: string; className?: string }) {
  const pathname = usePathname() ?? ''
  const segment = getRouteSegment(pathname, orgSlug)
  const Icon = ROUTE_ICONS[segment] || LayoutDashboard
  return <Icon className={className} />
}
