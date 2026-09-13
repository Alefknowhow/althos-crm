import Link from 'next/link'
import { Lock } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

/**
 * Mesmo padrão de paywall usado em app/app/[orgSlug]/relatorios/page.tsx —
 * reaproveitado aqui pra toda página do Althos Voice. Nunca 404/erro: a
 * rota sempre renderiza, só troca o conteúdo por este card.
 */
export function VoicePaywall({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Althos Voice" hint="Central de telefonia, SMS e Voice AI integrada ao CRM." />
      <div className="rounded-none border bg-card p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">Althos Voice é um recurso do plano Business</h2>
          <p className="text-sm text-muted-foreground">
            Centralize chamadas, SMS e agentes de voz com IA diretamente no seu CRM.
          </p>
        </div>
        <Link
          href={`/app/${orgSlug}/upgrade`}
          className="inline-flex items-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Fazer upgrade
        </Link>
      </div>
    </div>
  )
}
