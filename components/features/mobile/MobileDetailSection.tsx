import { MobileCard } from './MobileCard'

/**
 * Seção de detalhe M3 (spec mobile G3/4.6): resumo → pendências → dados
 * agrupados → vínculos/histórico → ações secundárias, uma tela só, sem
 * detalhe renderizado abaixo de uma lista longa.
 */
export function MobileDetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium text-m3-on-surface-variant uppercase tracking-wide px-1">{title}</h3>
      <MobileCard className="space-y-3">{children}</MobileCard>
    </section>
  )
}

/** Par rótulo/valor dentro de uma MobileDetailSection — largura do rótulo fixa pra alinhar visualmente entre linhas. */
export function MobileDetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-m3-on-surface-variant shrink-0">{label}</span>
      <span className="text-sm text-m3-on-surface text-right">{value}</span>
    </div>
  )
}
