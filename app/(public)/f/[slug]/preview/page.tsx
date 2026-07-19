import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicFormClient from '../PublicFormClient'

export const dynamic = 'force-dynamic'

export default async function PreviewPublicFormPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('*').eq('slug', params.slug).single()
  
  if (!form) notFound()

  const hideHeader = !!form.schema?.welcome?.enabled || form.schema?.mode === 'one_question'

  return (
    <div className="min-h-screen bg-muted/30 flex justify-center py-12 px-4 sm:px-6">
      <div className="w-full max-w-lg bg-background border rounded-none   p-6 sm:p-10 self-start">
        {!hideHeader && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">{form.name}</h1>
          </div>
        )}
        <PublicFormClient form={form} isPreview={true} />
      </div>
    </div>
  )
}
