import type { Metadata } from 'next'
import Link from 'next/link'
import { SiteShell } from '@/components/site/SiteShell'
import { BlogCoverArt } from '@/components/site/BlogCoverArt'
import { POSTS_SORTED, formatPostDate } from '@/lib/blog/posts'
import { buildPageMetadata } from '@/lib/landing/seo'

export const metadata: Metadata = buildPageMetadata({
  title: 'Althos CRM | Blog sobre Vendas e Automação Comercial',
  description:
    'Conteúdo sobre Meta Ads, Google Ads, funil de vendas, gestão de equipe e treinamento de vendas (SDR, Closer, CS) para você vender mais.',
  path: '/blog',
})

export default function BlogIndexPage() {
  const [featured, ...rest] = POSTS_SORTED

  return (
    <SiteShell>
      <section className="relative overflow-hidden pt-10 pb-6 sm:pt-24 sm:pb-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-[#4589ff]/20 blur-[120px]" />
        </div>
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#4589ff]/40 bg-[#0f62fe]/10 px-3 py-1 text-xs font-medium text-[#78a9ff]">
            Blog
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#f4f4f4] sm:mt-5 sm:text-5xl">
            Aprenda a vender mais
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-lg">
            Estratégias práticas de tráfego, funil de vendas e gestão de equipe — direto ao ponto.
          </p>
        </div>
      </section>

      <section className="relative mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-24">
        {/* Destaque */}
        <Link
          href={`/blog/${featured.slug}`}
          className="group flex flex-col overflow-hidden rounded-none border border-[#383838] bg-[#262626] transition-colors hover:border-[#78a9ff] md:flex-row"
        >
          <BlogCoverArt category={featured.category} iconSize={56} className="h-40 w-full shrink-0 md:h-auto md:w-72" />
          <div className="p-5 sm:p-9">
            <div className="flex items-center gap-3 text-[12px] text-[#8d8d8d]">
              <span className="rounded-full bg-[#4589ff]/15 px-2.5 py-0.5 font-semibold text-[#78a9ff]">{featured.category}</span>
              <span>{formatPostDate(featured.date)}</span>
              <span>· {featured.readingMinutes} min de leitura</span>
            </div>
            <h2 className="mt-3 text-xl font-bold text-[#f4f4f4] group-hover:text-[#78a9ff] transition-colors sm:mt-4 sm:text-3xl">
              {featured.title}
            </h2>
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[#a8a8a8] sm:mt-3 sm:text-[15px]">{featured.excerpt}</p>
            <span className="mt-5 inline-flex text-[14px] font-semibold text-[#0f62fe] group-hover:text-[#78a9ff]">
              Ler artigo →
            </span>
          </div>
        </Link>

        {/* Grade */}
        <div className="mt-4 grid gap-3 sm:mt-6 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {rest.map(p => (
            <Link
              key={p.slug}
              href={`/blog/${p.slug}`}
              className="group flex flex-col overflow-hidden rounded-none border border-[#383838] bg-[#262626] transition-colors hover:border-[#78a9ff] hover:bg-[#1f1f1f]"
            >
              <BlogCoverArt category={p.category} iconSize={32} className="h-28 w-full" />
              <div className="flex flex-1 flex-col p-5 sm:p-6">
                <div className="flex items-center gap-2 text-[11px] text-[#8d8d8d]">
                  <span className="rounded-full bg-[#4589ff]/15 px-2 py-0.5 font-semibold text-[#78a9ff]">{p.category}</span>
                  <span>{p.readingMinutes} min</span>
                </div>
                <h3 className="mt-3 text-[17px] font-bold text-[#f4f4f4] group-hover:text-[#78a9ff] transition-colors">{p.title}</h3>
                <p className="mt-2 flex-1 text-[13px] leading-relaxed text-[#a8a8a8]">{p.excerpt}</p>
                <span className="mt-4 text-[13px] font-semibold text-[#0f62fe] group-hover:text-[#78a9ff]">Ler →</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </SiteShell>
  )
}
