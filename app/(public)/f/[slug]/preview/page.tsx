import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicFormClient from '../PublicFormClient'
import { resolveFormBackground } from '@/lib/forms/background-presets'

export const dynamic = 'force-dynamic'

export default async function PreviewPublicFormPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('*').eq('slug', params.slug).single()

  if (!form) notFound()

  const hideHeader = !!form.schema?.welcome?.enabled || form.schema?.mode === 'one_question'
  const background = resolveFormBackground(form.schema?.style?.backgroundPreset)

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-6 py-10"
      style={{ background }}
    >
      <div className="w-full max-w-lg">
        {!hideHeader && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold text-white">{form.name}</h1>
          </div>
        )}
        <PublicFormClient form={form} isPreview={true} />
      </div>
    </div>
  )
}
