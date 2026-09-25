export type MediaDimensions = { width: number; height: number }

/** Detecta a dimensão real de uma imagem/vídeo no browser antes do
 *  upload, pra exibição sem distorcer (ver MediaPreview). Retorna null
 *  pra PDF ou quando a detecção falha — a UI que chama isso decide pedir
 *  o enquadramento manualmente nesse caso. */
export function detectMediaDimensions(file: File): Promise<MediaDimensions | null> {
  return new Promise(resolve => {
    if (file.type.startsWith('image/')) {
      const img = new Image()
      const url = URL.createObjectURL(file)
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url) }
      img.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
      img.src = url
    } else if (file.type.startsWith('video/')) {
      const video = document.createElement('video')
      const url = URL.createObjectURL(file)
      video.preload = 'metadata'
      video.onloadedmetadata = () => { resolve({ width: video.videoWidth, height: video.videoHeight }); URL.revokeObjectURL(url) }
      video.onerror = () => { resolve(null); URL.revokeObjectURL(url) }
      video.src = url
    } else {
      resolve(null)
    }
  })
}

export const ORIENTATION_DIMENSIONS: Record<string, MediaDimensions> = {
  vertical: { width: 1080, height: 1920 },
  horizontal: { width: 1920, height: 1080 },
  quadrado: { width: 1080, height: 1080 },
}
