import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SiteShell } from '@/components/site/SiteShell'
import { PostBody } from '@/components/site/PostBody'
import { BlogCoverArt } from '@/components/site/BlogCoverArt'
import { BRAND } from '@/lib/constants/brand'
import { POSTS, getPost, getRelatedPosts, formatPostDate } from '@/lib/blog/posts'

export function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug)
  if (!post) return { title: 'Artigo não encontrado — Althos CRM' }
  const path = `/blog/${post.slug}`
  return {
    title: `${post.title} — Blog Althos CRM`,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      title: post.title,
      description: post.description,
      url: path,
      siteName: 'Althos CRM',
      type: 'article',
      publishedTime: post.date,
      locale: 'pt_BR',
      images: ['/opengraph-image'],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: ['/opengraph-image'],
    },
  }
}

/** JSON-LD Article para SEO. */
function articleJsonLd(post: NonNullable<ReturnType<typeof getPost>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'Althos CRM' },
  }
}

/** JSON-LD BreadcrumbList — Home > Blog > Post. */
function breadcrumbJsonLd(post: NonNullable<ReturnType<typeof getPost>>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Início', item: BRAND.domain },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BRAND.domain}/blog` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${BRAND.domain}/blog/${post.slug}` },
    ],
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const related = getRelatedPosts(post)

  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd(post)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(post)) }}
      />

      <article className="relative mx-auto max-w-3xl px-4 pt-8 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#8d8d8d] hover:text-[#f4f4f4] transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para o blog
        </Link>

        <BlogCoverArt category={post.category} iconSize={44} className="mt-6 h-48 w-full border border-[#383838] sm:h-64" />

        <div className="mt-6 flex items-center gap-3 text-[12px] text-[#8d8d8d]">
          <span className="rounded-full bg-[#4589ff]/15 px-2.5 py-0.5 font-semibold text-[#78a9ff]">{post.category}</span>
          <span>{formatPostDate(post.date)}</span>
          <span>· {post.readingMinutes} min de leitura</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-[#f4f4f4] sm:mt-4 sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[#a8a8a8] sm:mt-4 sm:text-[16px]">{post.excerpt}</p>

        <hr className="my-6 border-[#383838] sm:my-8" />

        <PostBody blocks={post.blocks} />
      </article>

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <h2 className="text-lg font-bold text-[#f4f4f4]">Continue lendo</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {related.map(p => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group flex flex-col overflow-hidden rounded-none border border-[#383838] bg-[#262626] transition-colors hover:border-[#78a9ff] hover:bg-[#1f1f1f]"
              >
                <BlogCoverArt category={p.category} iconSize={28} className="h-24 w-full" />
                <div className="p-5">
                  <span className="rounded-full bg-[#4589ff]/15 px-2 py-0.5 text-[11px] font-semibold text-[#78a9ff]">{p.category}</span>
                  <h3 className="mt-3 text-[15px] font-bold text-[#f4f4f4] group-hover:text-[#78a9ff] transition-colors">{p.title}</h3>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#a8a8a8] line-clamp-3">{p.excerpt}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  )
}
