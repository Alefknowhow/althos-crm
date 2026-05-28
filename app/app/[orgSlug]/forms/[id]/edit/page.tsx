import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import FormBuilder from '@/components/features/FormBuilder'
import FormPageHeader from '@/components/features/forms/FormPageHeader'

export default async function EditFormPage({ params }: { params: { orgSlug: string, id: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  
  const [{ data: form }, { data: pipelines }, { data: eventTypes }] = await Promise.all([
    supabase.from('forms').select('*').eq('id', params.id).eq('organization_id', org.id).maybeSingle(),
    supabase.from('pipelines').select('id, name').eq('organization_id', org.id),
    // Active event types so the form builder can offer them as post-submit booking CTAs.
    supabase
      .from('event_types')
      .select('slug, name, duration_minutes')
      .eq('organization_id', org.id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
  ])
  if (!form) notFound()

  const pipelineIds = pipelines?.map(p => p.id) || []
  let stages: any[] = []

  if (pipelineIds.length > 0) {
    const { data: fetchedStages } = await supabase.from('pipeline_stages').select('id, name, pipeline_id').in('pipeline_id', pipelineIds)
    stages = fetchedStages || []
  }

  return (
    // -m-6 cancels the layout padding so FormBuilder sits flush with the edges.
    // flex-col + overflow-hidden lets FormPageHeader take its natural height and
    // FormBuilder fill the rest via flex-1 inside it.
    <div className="-m-6 flex flex-col" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <FormPageHeader orgSlug={params.orgSlug} form={form} />
      <div className="flex-1 overflow-hidden">
        <FormBuilder
          orgSlug={params.orgSlug}
          initialForm={form}
          pipelines={pipelines || []}
          stages={stages || []}
          eventTypes={eventTypes || []}
        />
      </div>
    </div>
  )
}
