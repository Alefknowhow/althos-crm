import { createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Script from 'next/script'
import PublicFormClient from './PublicFormClient'

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

  return (
    <div className="min-h-screen bg-muted/30 flex justify-center py-12 px-4 sm:px-6">
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

      <div className="w-full max-w-lg bg-background border rounded-none   p-6 sm:p-10 self-start">
        {!hideHeader && (
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold">{form.name}</h1>
          </div>
        )}
        <PublicFormClient form={form} utms={utms} orgSlug={org?.slug || null} />
      </div>
    </div>
  )
}
