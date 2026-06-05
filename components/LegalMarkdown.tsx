import React from 'react'

/**
 * Minimal, dependency-free Markdown renderer for our legal documents
 * (Termos de Uso / Política de Privacidade).
 *
 * Supports the subset used by those docs:
 *   - `#` / `##` / `###` headings
 *   - unordered lists (`- `)
 *   - blockquotes (`> `)
 *   - horizontal rules (`---`)
 *   - paragraphs with inline **bold**, *italic* and [links](url)
 *
 * The first `#` H1 is skipped because the page renders its own title.
 */

type Block =
  | { type: 'h1' | 'h2' | 'h3' | 'p' | 'quote'; text: string; id?: string }
  | { type: 'ul'; items: string[] }
  | { type: 'hr' }

function parse(md: string): Block[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let para: string[] = []
  let list: string[] | null = null
  let quote: string[] | null = null

  const flushPara = () => {
    if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = [] }
  }
  const flushList = () => {
    if (list) { blocks.push({ type: 'ul', items: list }); list = null }
  }
  const flushQuote = () => {
    if (quote) { blocks.push({ type: 'quote', text: quote.join(' ') }); quote = null }
  }
  const flushAll = () => { flushPara(); flushList(); flushQuote() }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const trimmed = line.trim()

    if (trimmed === '') { flushAll(); continue }
    if (trimmed === '---' || trimmed === '***') { flushAll(); blocks.push({ type: 'hr' }); continue }

    const h = /^(#{1,3})\s+(.*)$/.exec(trimmed)
    if (h) {
      flushAll()
      const level = h[1].length
      // Optional explicit anchor: "## Título {#meu-id}"
      let text = h[2]
      let id: string | undefined
      const anchor = /\s*\{#([A-Za-z0-9_-]+)\}\s*$/.exec(text)
      if (anchor) { id = anchor[1]; text = text.slice(0, anchor.index).trim() }
      blocks.push({ type: level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3', text, id })
      continue
    }

    const li = /^[-*]\s+(.*)$/.exec(trimmed)
    if (li) { flushPara(); flushQuote(); list = list || []; list.push(li[1]); continue }

    const q = /^>\s?(.*)$/.exec(trimmed)
    if (q) { flushPara(); flushList(); quote = quote || []; quote.push(q[1]); continue }

    flushList(); flushQuote()
    para.push(trimmed)
  }
  flushAll()
  return blocks
}

// Inline: **bold**, *italic*, [text](url)
function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  const re = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(\[([^\]]+)\]\(([^)]+)\))/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index))
    if (m[1]) {
      nodes.push(<strong key={`${keyPrefix}-b${i}`}>{m[2]}</strong>)
    } else if (m[3]) {
      nodes.push(<em key={`${keyPrefix}-i${i}`}>{m[4]}</em>)
    } else if (m[5]) {
      const href = m[7]
      const ext = /^https?:\/\//.test(href)
      nodes.push(
        <a
          key={`${keyPrefix}-a${i}`}
          href={href}
          className="text-indigo-600 underline"
          {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {m[6]}
        </a>,
      )
    }
    last = re.lastIndex
    i++
  }
  if (last < text.length) nodes.push(text.slice(last))
  return nodes
}

export default function LegalMarkdown({ source, skipH1 = true }: { source: string; skipH1?: boolean }) {
  const blocks = parse(source)
  let sawH1 = false

  return (
    <div className="space-y-2">
      {blocks.map((b, idx) => {
        const key = `blk-${idx}`
        switch (b.type) {
          case 'h1':
            if (skipH1 && !sawH1) { sawH1 = true; return null }
            return <h1 key={key} id={b.id} className="mt-8 scroll-mt-24 text-2xl font-bold text-slate-900">{inline(b.text, key)}</h1>
          case 'h2':
            return <h2 key={key} id={b.id} className="mt-8 scroll-mt-24 text-lg font-semibold text-slate-900">{inline(b.text, key)}</h2>
          case 'h3':
            return <h3 key={key} id={b.id} className="mt-6 scroll-mt-24 text-base font-semibold text-slate-900">{inline(b.text, key)}</h3>
          case 'p':
            return <p key={key} className="mt-2">{inline(b.text, key)}</p>
          case 'ul':
            return (
              <ul key={key} className="ml-5 mt-2 list-disc space-y-1.5">
                {b.items.map((it, j) => <li key={`${key}-${j}`}>{inline(it, `${key}-${j}`)}</li>)}
              </ul>
            )
          case 'quote':
            return (
              <blockquote key={key} className="mt-4 border-l-4 border-indigo-200 bg-indigo-50/50 px-4 py-3 text-slate-600">
                {inline(b.text, key)}
              </blockquote>
            )
          case 'hr':
            return <hr key={key} className="my-6 border-slate-200" />
          default:
            return null
        }
      })}
    </div>
  )
}
