'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'
import { getLinkPreview, type LinkPreviewResult } from '@/actions/link-preview'

/** Torna toda URL http(s) dentro de um texto clicável — usado nos balões
 *  de mensagem do WhatsApp. Preserva o resto do texto como está (só
 *  substitui o trecho da URL por um <a>). */
export function linkifyText(text: string): React.ReactNode {
  const re = /https?:\/\/[^\s<>"]+/gi
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let key = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const url = match[0].replace(/[.,;:!?)]+$/, '')
    parts.push(
      <a key={key++} href={url} target="_blank" rel="noopener noreferrer" className="underline text-blue-600 dark:text-blue-400 break-all">
        {url}
      </a>,
    )
    lastIndex = match.index + url.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length > 0 ? parts : text
}

/** Card de prévia (título, descrição, imagem) pra um link dentro de uma
 *  mensagem — busca sob demanda (client-side, uma Server Action por
 *  mensagem com link) porque é conteúdo opcional/raro, diferente da
 *  mídia da mensagem em si (essa sim sempre resolvida em lote,
 *  server-side, na primeira carga — ver conversas/page.tsx). Resultado
 *  fica cacheado 7 dias no banco (actions/link-preview.ts), então
 *  reabrir a mesma conversa não rebusca o site de destino. */
export function LinkPreviewCard({ url }: { url: string }) {
  const [preview, setPreview] = useState<LinkPreviewResult | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getLinkPreview(url).then(res => { if (!cancelled) setPreview(res) }).catch(() => { if (!cancelled) setPreview(null) })
    return () => { cancelled = true }
  }, [url])

  if (!preview) return null

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1.5 block overflow-hidden rounded-lg border border-black/10 dark:border-white/10 bg-black/[0.03] dark:bg-white/[0.04] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] transition-colors"
    >
      {preview.imageProxyUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview.imageProxyUrl} alt="" className="w-full max-h-48 object-cover" />
      )}
      <div className="px-2.5 py-2 space-y-0.5">
        {preview.siteName && (
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            <ExternalLink className="w-2.5 h-2.5" /> {preview.siteName}
          </div>
        )}
        {preview.title && <div className="text-xs font-medium leading-snug line-clamp-2">{preview.title}</div>}
        {preview.description && <div className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{preview.description}</div>}
      </div>
    </a>
  )
}
