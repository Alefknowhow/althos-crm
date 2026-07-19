import { redirect } from 'next/navigation'

export default function AtendenteIaPlaygroundRedirect({
  params,
  searchParams,
}: {
  params: { orgSlug: string }
  searchParams: { session?: string }
}) {
  const params2 = new URLSearchParams({ tab: 'testar' })
  if (searchParams.session) params2.set('session', searchParams.session)
  redirect(`/app/${params.orgSlug}/configuracoes/agente-ia?${params2.toString()}`)
}
