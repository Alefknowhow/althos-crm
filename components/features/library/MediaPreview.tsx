'use client'

import { FileText } from 'lucide-react'

const MAX_BOX = 420

/**
 * Preview de imagem/vídeo da Biblioteca — nunca estica nem corta: a
 * moldura é calculada a partir da proporção real (width/height salvos no
 * upload), limitada a um tamanho máximo padrão (MAX_BOX). Sem
 * width/height (asset antigo, ou detecção falhou e ninguém escolheu
 * enquadramento manualmente), cai num box quadrado com object-contain —
 * pode sobrar borda, mas nunca distorce a imagem/vídeo.
 */
export default function MediaPreview({
  src, mimeType, width, height, title,
}: {
  src: string
  mimeType: string | null
  width: number | null
  height: number | null
  title: string
}) {
  if (mimeType === 'application/pdf') {
    return (
      <a href={src} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 rounded-md border bg-muted/20 text-xs text-primary hover:underline">
        <FileText className="w-4 h-4" /> Abrir PDF
      </a>
    )
  }

  const ratio = width && height ? width / height : null
  let boxW = MAX_BOX
  let boxH = MAX_BOX
  if (ratio) {
    if (ratio >= 1) {
      boxW = MAX_BOX
      boxH = MAX_BOX / ratio
    } else {
      boxH = MAX_BOX
      boxW = MAX_BOX * ratio
    }
  }

  return (
    <div
      className="rounded-md border overflow-hidden bg-muted/30 flex items-center justify-center mx-auto"
      style={{ width: boxW, height: boxH, maxWidth: '100%' }}
    >
      {mimeType?.startsWith('video/') ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption -- material interno de tráfego, sem legenda de acessibilidade a manter
        <video src={src} controls className="w-full h-full object-contain" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada de curta duração, não cacheável pelo otimizador de imagem do Next
        <img src={src} alt={title} className="w-full h-full object-contain" />
      )}
    </div>
  )
}
