import { getOrgGeneral } from '@/actions/organization'
import GeneralTab from '@/components/features/GeneralTab'
import SettingsTabsNav from './SettingsTabsNav'

export default async function SettingsPage({ params }: { params: { orgSlug: string } }) {
  // Niche is account-level; getOrgGeneral reads the authoritative account value
  // and enforces access via getCurrentOrganization internally.
  const general = await getOrgGeneral(params.orgSlug)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua conta, organizações, membros e integrações.</p>
      </div>

      <SettingsTabsNav orgSlug={params.orgSlug} />

      <GeneralTab orgSlug={params.orgSlug} initialNiche={general.niche} />
    </div>
  )
}
