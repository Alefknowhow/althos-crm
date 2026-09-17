/** Classes de badge pro Kanban/Lista de Projetos — health é independente do
 *  status do Kanban (ver PROJECT_HEALTH_LABEL em lib/validators/project.ts). */
import type { ProjectHealth } from '@/lib/validators/project'

export const PROJECT_HEALTH_BADGE_CLASS: Record<ProjectHealth, string> = {
  normal: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  atencao: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  bloqueado: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  aguardando_cliente: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-300 dark:border-sky-800',
  em_risco: 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800',
}
