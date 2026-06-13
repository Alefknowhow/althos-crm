import { getOrgGeneral, getAccountOrganizations } from '@/actions/organization'
import { getTeamData } from '@/actions/team'
import GeneralTab from '@/components/features/GeneralTab'
import OrganizationsClient from './organizacoes/OrganizationsClient'
import SettingsTabsNav from './SettingsTabsNav'

export default async function SettingsPage({ params }: { params: { orgSlug: string } }) {
  // Niche is account-level; getOrgGeneral reads the authoritative account value
  // and enforces access via getCurrentOrganization internally.
  const [general, organizations, team] = await Promise.all([
    getOrgGeneral(params.orgSlug),
    getAccountOrganizations(params.orgSlug),
    getTeamData(params.orgSlug),
  ])

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <GeneralTab orgSlug={params.orgSlug} initialNiche={general.niche} />

      {/* Organização do cliente + dados da empresa (CNPJ, telefone, e-mail…) —
          os mesmos campos usados no cabeçalho/rodapé das cotações. */}
      <div className="space-y-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Sua Empresa</h2>
          <p className="text-sm text-muted-foreground">
            Dados que aparecem nas cotações e propostas geradas.
          </p>
        </div>
        <OrganizationsClient
          orgSlug={params.orgSlug}
          organizations={organizations}
          members={team.members}
          canManage={team.currentUserIsManager}
        />
      </div>
    </div>
  )
}
