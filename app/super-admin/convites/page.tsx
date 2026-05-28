import { listInvites } from '@/actions/invites'
import InviteManager from '@/components/features/billing/InviteManager'

export default async function SuperAdminInvitesPage() {
  const { invites } = await listInvites()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Convites</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gere links de convite para clientes da agência ou contas especiais.
          O usuário cria a conta no Althos CRM já com o plano configurado, sem passar pelo Asaas.
        </p>
      </div>

      <InviteManager initialInvites={invites} />
    </div>
  )
}
