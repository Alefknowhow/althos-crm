import { createClient } from '@/lib/supabase/server'
import { getCurrentOrganization } from '@/lib/supabase/types'
import SettingsTabs from './SettingsTabs'

export default async function SettingsPage({ params }: { params: { orgSlug: string } }) {
  const org      = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data } = await supabase
    .from('organizations')
    .select('logo_url, primary_color')
    .eq('id', org.id)
    .maybeSingle()

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie sua organização, membros e integrações.</p>
      </div>

      <SettingsTabs
        orgSlug={params.orgSlug}
        orgId={org.id}
        initialLogoUrl={data?.logo_url ?? null}
        initialColor={data?.primary_color ?? null}
      />
    </div>
  )
}
