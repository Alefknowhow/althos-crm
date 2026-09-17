import Link from 'next/link'
import { Lock } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'

/** Mesmo padrão de paywall do Althos Voice (VoicePaywall.tsx) — reaproveitado aqui. */
export function SalesCoachPaywall({ orgSlug }: { orgSlug: string }) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="IA Sales Coach" hint="Copiloto comercial com IA que acompanha suas reuniões em tempo real." />
      <div className="rounded-none border bg-card p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h2 className="font-semibold">IA Sales Coach é um recurso dos planos Pro e Business</h2>
          <p className="text-sm text-muted-foreground">
            Transcrição em tempo real, detecção de objeções e sinais de compra, e coaching baseado em evidências das suas próprias reuniões.
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
