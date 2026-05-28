import Link from 'next/link'
import { Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  /** If false, renders children normally. If true, shows locked overlay. */
  locked: boolean
  orgSlug: string
  featureName: string
  requiredPlan?: string
  children: React.ReactNode
}

/**
 * Server component wrapper that overlays a "upgrade required" message when
 * the feature isn't available on the current plan.
 *
 * Usage in a server page:
 *
 *   const hasAI = await canUseAI(org.id)
 *   return (
 *     <UpgradeGate locked={!hasAI} orgSlug={orgSlug} featureName="Score IA" requiredPlan="Pro">
 *       <AIContent />
 *     </UpgradeGate>
 *   )
 */
export default function UpgradeGate({ locked, orgSlug, featureName, requiredPlan = 'Pro', children }: Props) {
  if (!locked) return <>{children}</>

  return (
    <div className="relative min-h-[400px]">
      {/* Blurred background hint */}
      <div className="pointer-events-none select-none opacity-30 blur-sm">
        {children}
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm rounded-xl">
        <div className="flex flex-col items-center gap-3 text-center p-6 max-w-sm">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold text-lg">{featureName}</h3>
          <p className="text-sm text-muted-foreground">
            Este recurso está disponível a partir do plano{' '}
            <span className="font-medium text-foreground">{requiredPlan}</span>.
            Faça upgrade para desbloquear.
          </p>
          <Button asChild className="w-full">
            <Link href={`/app/${orgSlug}/upgrade`}>Ver planos</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
