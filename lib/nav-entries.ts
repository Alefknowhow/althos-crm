import {
  LayoutDashboard,
  Kanban,
  Users,
  CheckSquare,
  FileText,
  Package,
  ShoppingCart,
  Mail,
  MessageSquare,
  Zap,
  Settings,
  Calendar,
  Megaphone,
  Bot,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export type NavEntry = {
  label: string
  href: string
  icon: LucideIcon
  keywords?: string
}

/** Atalhos de navegação da busca global — usados tanto pelo command palette
 *  (⌘K, modal) quanto pela busca inline do header (HeaderSearchBar). Fonte
 *  única para não divergir a lista entre os dois lugares. */
export function getGlobalNavEntries(base: string): NavEntry[] {
  return [
    { label: 'Dashboard', href: base, icon: LayoutDashboard, keywords: 'inicio home painel' },
    { label: 'Insights IA', href: `${base}/insights`, icon: Sparkles, keywords: 'analista ia chat' },
    { label: 'Pipeline', href: `${base}/pipeline`, icon: Kanban, keywords: 'kanban funil' },
    { label: 'Contatos', href: `${base}/contatos`, icon: Users, keywords: 'leads clientes customers compradores' },
    { label: 'Tarefas', href: `${base}/tarefas`, icon: CheckSquare, keywords: 'todo agenda atividades' },
    { label: 'Forms', href: `${base}/forms`, icon: FileText, keywords: 'formularios captura' },
    { label: 'Catálogo', href: `${base}/catalogo`, icon: Package, keywords: 'produtos servicos' },
    { label: 'Vendas', href: `${base}/vendas`, icon: ShoppingCart, keywords: 'sales fechamentos receita' },
    { label: 'Agendamentos', href: `${base}/agendamentos`, icon: Calendar, keywords: 'booking reunioes' },
    { label: 'Templates', href: `${base}/email-templates`, icon: Mail, keywords: 'email modelo' },
    { label: 'Conversas', href: `${base}/conversas`, icon: MessageSquare, keywords: 'whatsapp chat mensagens' },
    { label: 'Agente IA', href: `${base}/configuracoes/agente-ia`, icon: Bot, keywords: 'bot ai whatsapp atendente' },
    { label: 'Marketing', href: `${base}/marketing`, icon: Megaphone, keywords: 'ads campanhas meta' },
    { label: 'Automações', href: `${base}/automacoes`, icon: Zap, keywords: 'workflow gatilhos' },
    { label: 'Configurações', href: `${base}/configuracoes`, icon: Settings, keywords: 'config settings ajustes' },
  ]
}
