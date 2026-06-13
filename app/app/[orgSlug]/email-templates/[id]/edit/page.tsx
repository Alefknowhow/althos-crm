import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import EmailTemplateEditor from '@/components/features/EmailTemplateEditor'

export default async function EditTemplatePage({ params }: { params: { orgSlug: string, id: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()
  
  const { data: template } = await supabase.from('email_templates').select('*').eq('id', params.id).eq('organization_id', org.id).single()
  if (!template) notFound()

  const { data: lead } = await supabase.from('contatos').select('*').eq('organization_id', org.id).limit(1).single()

  return (
    <div className="h-[calc(100vh-4rem)] -m-6 flex flex-col">
      <EmailTemplateEditor orgSlug={params.orgSlug} initialTemplate={template} sampleLead={lead} org={org} />
    </div>
  )
}
