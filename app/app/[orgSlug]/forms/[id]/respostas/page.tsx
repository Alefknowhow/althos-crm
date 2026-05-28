import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { notFound } from 'next/navigation'
import { getFormWithSubmissions } from '@/actions/form_submissions'
import FormPageHeader from '@/components/features/forms/FormPageHeader'
import FormResponsesView from '@/components/features/forms/FormResponsesView'

const PAGE_SIZE = 25

export default async function FormResponsesPage({
  params,
  searchParams,
}: {
  params: { orgSlug: string; id: string }
  searchParams?: { from?: string; to?: string; utm_source?: string; utm_campaign?: string; page?: string }
}) {
  await requireAuth()
  await getCurrentOrganization(params.orgSlug)

  const page = Math.max(0, parseInt(searchParams?.page || '0', 10) || 0)

  const { form, submissions, total } = await getFormWithSubmissions(params.orgSlug, params.id, {
    from: searchParams?.from || null,
    to: searchParams?.to ? `${searchParams.to}T23:59:59` : null,
    utmSource: searchParams?.utm_source || null,
    utmCampaign: searchParams?.utm_campaign || null,
    page,
    pageSize: PAGE_SIZE,
  })

  if (!form) notFound()

  return (
    <div className="-m-6">
      <FormPageHeader orgSlug={params.orgSlug} form={form} />
      <FormResponsesView
        orgSlug={params.orgSlug}
        form={form}
        submissions={submissions as any}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        filters={{
          from: searchParams?.from,
          to: searchParams?.to,
          utmSource: searchParams?.utm_source,
          utmCampaign: searchParams?.utm_campaign,
        }}
      />
    </div>
  )
}
