import { getInvitationInfo, getInviteeAccountStatus } from '@/actions/team'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2, CheckCircle2, AlertTriangle, LogIn, XCircle } from 'lucide-react'
import AcceptButton from './AcceptButton'
import InviteeSignupForm from './InviteeSignupForm'

export default async function ConvitePage({
  params,
}: {
  params: { token: string }
}) {
  const inv = await getInvitationInfo(params.token)

  if (!inv) {
    return (
      <InvitePage
        icon={<XCircle className="w-10 h-10 text-destructive" />}
        title="Convite inválido"
        description="Este link de convite não existe ou já foi utilizado."
        action={<Link href="/login"><Button>Ir para o login</Button></Link>}
      />
    )
  }

  if (inv.expired) {
    return (
      <InvitePage
        icon={<AlertTriangle className="w-10 h-10 text-amber-500" />}
        title="Convite expirado"
        description={`Este convite para ${inv.orgName} expirou. Peça ao administrador que envie um novo convite.`}
        action={<Link href="/login"><Button variant="outline">Ir para o login</Button></Link>}
      />
    )
  }

  if (inv.accepted) {
    return (
      <InvitePage
        icon={<CheckCircle2 className="w-10 h-10 text-emerald-500" />}
        title="Convite já aceito"
        description={`Você já é membro de ${inv.orgName}.`}
        action={<Link href={`/app/${inv.orgSlug}/pipeline`}><Button>Abrir workspace</Button></Link>}
      />
    )
  }

  // Check if user is logged in
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    // Not logged in. A brand-new invitee has no password yet, so route them to
    // a lightweight signup (name + password) instead of a login screen they
    // can't pass. An existing user just logs in and the invite is accepted.
    const status = await getInviteeAccountStatus(params.token)
    const redirectTo = `/convite/${params.token}`

    if (status.ok && !status.hasAccount) {
      return (
        <InvitePage
          icon={<Building2 className="w-10 h-10 text-primary" />}
          title={`Você foi convidado para ${inv.orgName}`}
          description="Crie seu acesso para entrar no workspace."
          action={
            <InviteeSignupForm token={params.token} email={inv.email} role={inv.role} />
          }
        />
      )
    }

    return (
      <InvitePage
        icon={<Building2 className="w-10 h-10 text-primary" />}
        title={`Você foi convidado para ${inv.orgName}`}
        description={`Faça login com o e-mail ${inv.email} para aceitar o convite.`}
        action={
          <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`}>
            <Button className="w-full gap-2">
              <LogIn className="w-4 h-4" />
              Fazer login para aceitar
            </Button>
          </Link>
        }
      />
    )
  }

  const ROLE_LABEL: Record<string, string> = {
    admin:  'Administrador',
    member: 'Membro',
  }

  return (
    <InvitePage
      icon={<Building2 className="w-10 h-10 text-primary" />}
      title={`Convite para ${inv.orgName}`}
      description={`Você foi convidado como ${ROLE_LABEL[inv.role] ?? inv.role}. Clique abaixo para aceitar e acessar o workspace.`}
      action={<AcceptButton token={params.token} />}
    />
  )
}

// ── Layout helper ─────────────────────────────────────────────────────────────

function InvitePage({
  icon,
  title,
  description,
  action,
}: {
  icon:        React.ReactNode
  title:       string
  description: string
  action:      React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#eef2f7] p-4">
      <div className="w-full max-w-[420px]">
        <div className="text-center mb-8">
          <span className="text-2xl font-black tracking-tighter">Althos CRM</span>
        </div>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-5">
          <div className="flex justify-center">{icon}</div>
          <div>
            <h1 className="text-lg font-bold">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{description}</p>
          </div>
          <div className="pt-1">{action}</div>
        </div>
      </div>
    </div>
  )
}
