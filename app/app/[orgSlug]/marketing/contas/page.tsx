import { cookies } from 'next/headers'
import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { listAdAccounts, getMetaAdsLoginStatus } from '@/actions/marketing'
import { listAdAccountsForToken, type MetaAdAccountOption } from '@/lib/meta/ads-oauth'
import AdAccountsManager from '@/components/features/marketing/AdAccountsManager'
import SelectMetaAdAccounts from '@/components/features/marketing/SelectMetaAdAccounts'

export const dynamic = 'force-dynamic'

export default async function MarketingAccountsPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { step?: string; error?: string; msg?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  if (searchParams.step === 'select') {
    const cookieStore = cookies()
    const token = cookieStore.get('meta_ads_pending_token')?.value
    const pendingOrg = cookieStore.get('meta_ads_pending_org')?.value

    if (token && pendingOrg === params.orgSlug) {
      let options: MetaAdAccountOption[] = []
      let error: string | null = null
      try {
        options = await listAdAccountsForToken(token)
      } catch (e: any) {
        error = e?.message || 'Falha ao listar contas de anúncio'
      }
      return (
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Escolha as contas de anúncio</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Conectado com sucesso. Marque as contas que você quer trazer pro CRM.
            </p>
          </div>
          <SelectMetaAdAccounts orgSlug={params.orgSlug} options={options} listError={error} />
        </div>
      )
    }
  }

  const [accounts, loginStatus] = await Promise.all([
    listAdAccounts(params.orgSlug),
    getMetaAdsLoginStatus(params.orgSlug),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contas de anúncio</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Conecte suas contas de anúncio Meta com login do Facebook, ou cadastre manualmente contas de outras plataformas.
        </p>
      </div>
      {searchParams.error && (
        <p className="text-sm text-destructive">
          {searchParams.error === 'not_configured'
            ? 'Integração com Facebook ainda não configurada nesta instância.'
            : searchParams.error === 'forbidden'
            ? 'Você não tem permissão para conectar contas de anúncio.'
            : `Falha ao conectar: ${searchParams.msg || searchParams.error}`}
        </p>
      )}

      <AdAccountsManager orgSlug={params.orgSlug} initial={accounts as any[]} metaLoginConnected={loginStatus.connected} />
    </div>
  )
}
