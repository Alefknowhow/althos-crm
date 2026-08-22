import type { LucideIcon } from 'lucide-react'
import EmptyState from '@/components/ui/empty-state'

/**
 * Página-base da vertical Agências de Tráfego (Etapa 1: fundação) — sem
 * dado real, sem query, só título/ícone/descrição por página. A UX
 * definitiva de cada tela vem em prompts futuros (ver plano de fundação);
 * este componente é deliberadamente genérico até lá.
 */
export default function PlaceholderPage({
  icon, title, description,
}: {
  icon: LucideIcon
  title: string
  description: string
}) {
  return (
    <div className="p-4 sm:p-6">
      <EmptyState icon={icon} title={title} description={description} />
    </div>
  )
}
