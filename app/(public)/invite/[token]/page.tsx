import { validateInvite } from '@/actions/invites'
import { getPlan } from '@/lib/billing/plans'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { CheckCircle2, XCircle } from 'lucide-react'

export default async function InvitePage({
  params,
}: {
  params: { token: string }
}) {
  const result = await validateInvite(params.token)

  if (!result.ok) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
        <div className="text-center space-y-4 max-w-sm">
          <XCircle className="w-12 h-12 text-destructive mx-auto" />
          <h1 className="text-xl font-bold">Convite inválido</h1>
          <p className="text-muted-foreground">{result.error}</p>
          <Button asChild variant="outline">
            <Link href="/login">Ir para o login</Link>
          </Button>
        </div>
      </div>
    )
  }

  const plan = getPlan(result.invite.plan)

  const features = [
    'Leads ilimitados',
    'Pipeline Kanban completo',
    'Score IA & Qualificação',
    'Automações',
    'WhatsApp & Conversas',
    'Insights IA',
    'Atendente IA',
    'Suporte dedicado',
  ]

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <div className="w-full max-w-md space-y-6">

        {/* Header */}
        <div className="text-center space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="Althos CRM" className="w-14 h-14 rounded-md object-cover mx-auto mb-3" />
          <h1 className="text-2xl font-bold">Você foi convidado</h1>
          <p className="text-muted-foreground">
            Acesso ao <strong>Althos CRM</strong> com o plano{' '}
            <span className="font-semibold text-foreground">{plan.label}</span>.
          </p>
        </div>

        {/* Plan card */}
        <div className="rounded-none border bg-card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-lg">{plan.label}</span>
            <span className="text-xs bg-primary/10 text-primary rounded-full px-3 py-1 font-medium">
              Convite exclusivo
            </span>
          </div>

          <ul className="space-y-2">
            {features.map(f => (
              <li key={f} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {f}
              </li>
            ))}
          </ul>

          {result.invite.email && (
            <p className="text-xs text-muted-foreground border-t pt-3">
              Este convite é restrito ao e-mail <strong>{result.invite.email}</strong>.
            </p>
          )}
        </div>

        {/* CTA */}
        <Button asChild size="lg" className="w-full">
          <Link href={`/signup?invite=${params.token}`}>
            Criar minha conta gratuitamente
          </Link>
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          Já tem uma conta?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
