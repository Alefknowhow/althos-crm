import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { SiteShell } from '@/components/site/SiteShell'
import { PostBody } from '@/components/site/PostBody'
import { POSTS, getPost, getRelatedPosts, formatPostDate } from '@/lib/blog/posts'

export function generateStaticParams() {
  return POSTS.map(p => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug)
  if (!post) return { title: 'Artigo não encontrado — Althos CRM' }
  return {
    title: `${post.title} — Blog Althos CRM`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
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

      <article className="relative mx-auto max-w-3xl px-4 pt-8 pb-14 sm:px-6 sm:pt-24 sm:pb-20">
        <Link href="/blog" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Voltar para o blog
        </Link>

        <div className="mt-6 flex items-center gap-3 text-[12px] text-slate-500">
          <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 font-semibold text-indigo-700">{post.category}</span>
          <span>{formatPostDate(post.date)}</span>
          <span>· {post.readingMinutes} min de leitura</span>
        </div>

        <h1 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-slate-900 sm:mt-4 sm:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-slate-600 sm:mt-4 sm:text-[16px]">{post.excerpt}</p>

        <hr className="my-6 border-slate-200 sm:my-8" />

        <PostBody blocks={post.blocks} />
      </article>

      {/* Relacionados */}
      {related.length > 0 && (
        <section className="relative mx-auto max-w-3xl px-4 pb-24 sm:px-6">
          <h2 className="text-lg font-bold text-slate-900">Continue lendo</h2>
          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {related.map(p => (
              <Link
                key={p.slug}
                href={`/blog/${p.slug}`}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-indigo-300 hover:bg-slate-50"
              >
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{p.category}</span>
                <h3 className="mt-3 text-[15px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{p.title}</h3>
                <p className="mt-2 text-[13px] leading-relaxed text-slate-600 line-clamp-3">{p.excerpt}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </SiteShell>
  )
}
