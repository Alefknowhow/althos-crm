import Link from 'next/link'
import type { PostBlock } from '@/lib/blog/posts'

/** Renderiza os blocos de conteúdo de um post do blog. */
export function PostBody({ blocks }: { blocks: PostBlock[] }) {
  return (
    <div className="space-y-5">
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h2':
            return <h2 key={i} className="pt-4 text-xl font-bold text-slate-900 sm:text-2xl">{b.text}</h2>
          case 'h3':
            return <h3 key={i} className="pt-2 text-lg font-semibold text-slate-900">{b.text}</h3>
          case 'p':
            return <p key={i} className="text-[15px] leading-relaxed text-slate-600">{b.text}</p>
          case 'ul':
            return (
              <ul key={i} className="space-y-2">
                {b.items.map(it => (
                  <li key={it} className="flex items-start gap-2.5 text-[15px] leading-relaxed text-slate-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4589ff]" />
                    {it}
                  </li>
                ))}
              </ul>
            )
          case 'ol':
            return (
              <ol key={i} className="space-y-2">
                {b.items.map((it, idx) => (
                  <li key={it} className="flex items-start gap-3 text-[15px] leading-relaxed text-slate-600">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#d0e2ff] text-[11px] font-bold text-[#0043ce]">
                      {idx + 1}
                    </span>
                    {it}
                  </li>
                ))}
              </ol>
            )
          case 'quote':
            return (
              <blockquote key={i} className="rounded-r-xl border-l-2 border-[#4589ff] bg-slate-50 py-3 pl-5 pr-4 text-[15px] italic leading-relaxed text-slate-700">
                {b.text}
              </blockquote>
            )
          case 'cta':
            return (
              <div key={i} className="my-2 rounded-none border border-[#a6c8ff] bg-[#edf5ff] p-6 text-center">
                <p className="text-[16px] font-semibold text-slate-900">{b.text}</p>
                <Link
                  href="/signup"
                  className="mt-4 inline-flex rounded-none bg-blue-600 px-6 py-2.5 text-[14px] font-semibold text-white   shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                >
                  Testar o Althos grátis
                </Link>
              </div>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
