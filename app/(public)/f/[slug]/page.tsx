import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Script from 'next/script'
import PublicFormClient from './PublicFormClient'
import { resolveFormBackground } from '@/lib/forms/background-presets'
import { resolveFormFontStack, googleFontsHref } from '@/lib/forms/font-presets'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('name, schema').eq('slug', params.slug).maybeSingle()
  const title = form?.name || 'Formulário'
  const description = form?.schema?.welcome?.description || 'Preencha o formulário abaixo.'
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
    robots: { index: false, follow: false },
  }
}

export default async function PublicFormPage({ params, searchParams }: { params: { slug: string }, searchParams: any }) {
  const supabase = createAdminClient()
  const { data: form } = await supabase.from('forms').select('*').eq('slug', params.slug).single()

  if (!form || !form.is_active) {
    notFound()
  }

  // Resolve the org slug + meta pixel config
  const { data: org } = await supabase
    .from('organizations')
    .select('slug, meta_pixel_id')
    .eq('id', form.organization_id)
    .maybeSingle()

  const utms = {
    source: searchParams.utm_source,
    medium: searchParams.utm_medium,
    campaign: searchParams.utm_campaign,
    content: searchParams.utm_content,
    term: searchParams.utm_term,
    gclid: searchParams.gclid,
    fbclid: searchParams.fbclid
  }

  const hideHeader = !!form.schema?.welcome?.enabled || form.schema?.mode === 'one_question'

  const metaPixelId = org?.meta_pixel_id || null
  const background = resolveFormBackground(form.schema?.style?.backgroundPreset)
  const fontFamily = resolveFormFontStack(form.schema?.style?.fontFamily)

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-neutral-950 p-4 sm:p-8 overflow-y-auto">
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="stylesheet" href={googleFontsHref(form.schema?.style?.fontFamily)} />
      {/* Meta Pixel base code — only injected when org has a pixel configured */}
      {metaPixelId && (
        <>
          <Script id="fb-pixel" strategy="afterInteractive">{`
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
            n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
            (window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init','${metaPixelId}');
            fbq('track','PageView');
          `}</Script>
          <noscript>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img height="1" width="1" style={{ display: 'none' }} alt=""
              src={`https://www.facebook.com/tr?id=${metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      {/* Mesmo enquadramento 9:16 do preview do editor (PreviewPane) — o
          fundo do formulário preenche o quadro inteiro, sem "cartão" branco
          por dentro, com o mesmo fundo neutro escuro ao redor. */}
      <div
        className="w-full max-w-[420px] aspect-[9/16] rounded-2xl shadow-2xl overflow-hidden flex flex-col shrink-0"
        style={{ background, fontFamily }}
      >
        <div className="flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 py-8 sm:py-10 flex flex-col justify-center">
          {!hideHeader && (
            <div className="mb-8 text-center">
              <h1 className="text-2xl font-bold text-white">{form.name}</h1>
            </div>
          )}
          <PublicFormClient form={form} utms={utms} orgSlug={org?.slug || null} />
        </div>
      </div>
    </div>
  )
}
