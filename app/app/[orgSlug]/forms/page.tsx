import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import NewFormButton from '@/components/features/NewFormButton'
import CreateFormWithAiDialog from '@/components/features/forms/CreateFormWithAiDialog'
import FormsListGrid, { type FormListItem } from '@/components/features/forms/FormsListGrid'

export default async function FormsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, slug, is_active, created_at, form_submissions(count)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  const items: FormListItem[] = (forms || []).map(form => ({
    id: form.id,
    name: form.name,
    slug: form.slug,
    is_active: form.is_active,
    created_at: form.created_at,
    submissionCount: (form.form_submissions as any)?.[0]?.count ?? 0,
  }))

  return (
    <div className="pt-3 space-y-6">
      <div className="flex items-center gap-2">
        <CreateFormWithAiDialog orgSlug={params.orgSlug} />
        <NewFormButton orgSlug={params.orgSlug} />
      </div>

      <FormsListGrid orgSlug={params.orgSlug} forms={items} />
    </div>
  )
}
