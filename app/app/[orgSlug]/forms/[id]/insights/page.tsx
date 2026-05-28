import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { notFound } from 'next/navigation'
import { getFormInsights } from '@/actions/form_submissions'
import FormPageHeader from '@/components/features/forms/FormPageHeader'
import FormInsightsView from '@/components/features/forms/FormInsightsView'

export default async function FormInsightsPage({
  params,
}: {
  params: { orgSlug: string; id: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const data = await getFormInsights(params.orgSlug, params.id)

  if (!data.form) notFound()

  return (
    <div className="-m-6">
      <FormPageHeader orgSlug={params.orgSlug} form={data.form} />
      <FormInsightsView data={data} />
    </div>
  )
}
