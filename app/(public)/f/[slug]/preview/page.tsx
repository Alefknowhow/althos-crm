import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PublicFormClient from '../PublicFormClient'
import { resolveFormBackground } from '@/lib/forms/background-presets'
import { resolveFormFontStack, googleFontsHref } from '@/lib/forms/font-presets'

export const dynamic = 'force-dynamic'

export default async function PreviewPublicFormPage({ params }: { params: { slug: string } }) {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('*').eq('slug', params.slug).single()

  if (!form) notFound()

  const hideHeader = !!form.schema?.welcome?.enabled || form.schema?.mode === 'one_question'
  const background = resolveFormBackground(form.schema?.style?.backgroundPreset)
  const fontFamily = resolveFormFontStack(form.schema?.style?.fontFamily)

  return (
    <div
      className="min-h-[100dvh] flex items-center justify-center px-6 py-10"
      style={{ background, fontFamily }}
    >
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(form.schema?.style?.fontFamily)} />
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
