import { cn } from '@/lib/utils'

/** Card M3 — raio 12px, sem sombra por padrão (spec mobile G1, 4.3). */
export function MobileCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-mcard bg-m3-surface-container-low border border-m3-outline-variant/60 p-4', className)}>
      {children}
    </div>
  )
}
