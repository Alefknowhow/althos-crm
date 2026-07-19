import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicFormClient from '../PublicFormClient'

export const dynamic = 'force-dynamic'

export default async function PreviewPublicFormPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('*').eq('slug', params.slug).single()
  
  if (!form) notFound()

  const hideHeader = !!form.schema?.welcome?.enabled || form.schema?.mode === 'one_question'
  const bgColor = form.schema?.style?.backgroundColor || null

  return (
    <div
      className={`min-h-[100dvh] flex sm:items-center justify-center sm:py-12 px-0 sm:px-6 ${bgColor ? '' : 'bg-muted/30'}`}
      style={bgColor ? { backgroundColor: bgColor } : undefined}
    >
      <div className="w-full sm:max-w-lg min-h-[100dvh] sm:min-h-0 bg-transparent sm:bg-background sm:border rounded-none p-6 sm:p-10 flex flex-col justify-center">
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
