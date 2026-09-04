'use client'

/**
 * Stateless/self-contained pieces of the WhatsApp chat UI -- message
 * status ticks, media rendering, search highlighting, the 24h-window
 * badge, inbox time formatting, and small UI constants. None of these
 * read WhatsappChat's local state, so this is a pure move. Split out of
 * WhatsappChat.tsx.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Download, FileText } from 'lucide-react'
import { getObjectSignedUrl } from '@/actions/storage'

export function msgBody(m: any): string {
  return m?.content?.text?.body || m?.content?.body || ''
}

// Botão de download — só aparece quando a mensagem tem media_object_id
// (mídia migrada pro R2; mensagem antiga/legada sem essa referência não
// ganha o botão). Ao clicar, pede uma signed URL nova com
// Content-Disposition: attachment (força download mesmo pra imagem/PDF,
// que o navegador abriria inline com a URL "de visualização" normal).
export function DownloadMediaButton({ orgSlug, objectId, className }: { orgSlug: string; objectId: string; className?: string }) {
  const [loading, setLoading] = useState(false)
  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      const res = await getObjectSignedUrl(orgSlug, objectId, { download: true })
      if (res.ok) window.open(res.url, '_blank', 'noopener,noreferrer')
      else toast.error(res.error)
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={loading}
      title="Baixar mídia"
      className={className ?? 'shrink-0 text-muted-foreground hover:text-foreground disabled:opacity-50'}
    >
      <Download className="w-4 h-4" />
    </button>
  )
}

// Renderiza a mídia de uma mensagem (o webhook baixa e salva a URL
// permanente em content.media_url — ver app/api/webhooks/whatsapp/route.ts).
// Retorna null pra mensagens de texto puro, deixando o texto normal aparecer.
export function renderWhatsappMedia(m: any, orgSlug: string, onImageClick?: (url: string) => void): React.ReactNode {
  const mediaUrl: string | undefined = m?.content?.media_url
  const objectId: string | undefined = m?.content?.media_object_id
  const caption: string | undefined = m?.content?.[m.type]?.caption
  if (!mediaUrl) return null

  if (m.type === 'image') {
    return (
      <div className="space-y-1.5">
        <div className="relative group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mediaUrl} alt="" className="rounded-lg max-w-full max-h-72 object-cover cursor-pointer"
            onClick={() => onImageClick?.(mediaUrl)}
          />
          {objectId && (
            <DownloadMediaButton
              orgSlug={orgSlug} objectId={objectId}
              className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity"
            />
          )}
        </div>
        {caption && <div className="whitespace-pre-wrap break-words">{caption}</div>}
      </div>
    )
  }
  if (m.type === 'sticker') {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={mediaUrl} alt="" className="w-32 h-32 object-contain" />
  }
  if (m.type === 'video') {
    return (
      <div className="space-y-1.5">
        <div className="flex items-end gap-1.5">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video controls src={mediaUrl} className="rounded-lg max-w-full max-h-72" />
          {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
        </div>
        {caption && <div className="whitespace-pre-wrap break-words">{caption}</div>}
      </div>
    )
  }
  if (m.type === 'audio') {
    return (
      <div className="flex items-center gap-1.5">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={mediaUrl} className="w-full max-w-[220px]" />
        {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
      </div>
    )
  }
  if (m.type === 'document') {
    const filename = m?.content?.document?.filename || 'Documento'
    return (
      <div className="flex items-center gap-2">
        <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline min-w-0">
          <FileText className="w-4 h-4 shrink-0" />
          <span className="truncate">{filename}</span>
        </a>
        {objectId && <DownloadMediaButton orgSlug={orgSlug} objectId={objectId} />}
      </div>
    )
  }
  return <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="underline">Abrir mídia</a>
}

// Destaca todas as ocorrências do termo de busca dentro de um texto.
export function highlightText(text: string, q: string): React.ReactNode {
  const term = q.trim()
  if (!term) return text
  const lower = text.toLowerCase()
  const needle = term.toLowerCase()
  const parts: React.ReactNode[] = []
  let i = 0
  let key = 0
  while (i < text.length) {
    const idx = lower.indexOf(needle, i)
    if (idx === -1) { parts.push(text.slice(i)); break }
    if (idx > i) parts.push(text.slice(i, idx))
    parts.push(<mark key={key++} className="bg-yellow-300/70 rounded-sm px-0.5 text-black">{text.slice(idx, idx + needle.length)}</mark>)
    i = idx + needle.length
  }
  return parts
}

// Marcadores de status estilo WhatsApp:
//  • relógio  → pendente/enviando
//  • 1 tique cinza → enviado (sent)
//  • 2 tiques cinza → entregue (delivered)
//  • 2 tiques azuis → lido (read)
//  • triângulo vermelho → falha
// Tick de confirmação ao lado do horário, na lista de conversas — mesmas
// regras do MessageTicks (relógio/1 check/2 checks/2 checks azuis), mas com
// cores pra fundo claro (a lista não tem o balão colorido de fundo).
export function ConversationTicks({ status }: { status?: string | null }) {
  if (status === 'failed') {
    return <span title="Falha no envio" className="text-red-500 text-[11px] leading-none shrink-0">⚠</span>
  }
  if (!status || status === 'pending' || status === 'sending') {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted-foreground/60" aria-label="Enviando">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'
  return (
    <svg
      width={isDouble ? 16 : 11}
      height="10"
      viewBox={isDouble ? '0 0 18 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${isRead ? 'text-sky-500' : 'text-muted-foreground/70'}`}
      aria-label={isRead ? 'Lida' : isDouble ? 'Entregue' : 'Enviada'}
    >
      <path d="M1 5.5 4.5 9 11 1.5" />
      {isDouble && <path d="M6 5.5 9.5 9 16 1.5" />}
    </svg>
  )
}

export function MessageTicks({ status }: { status?: string }) {
  if (status === 'failed') {
    return <span title="Falha no envio" className="text-red-500 text-[11px] leading-none">⚠</span>
  }
  if (!status || status === 'pending' || status === 'sending') {
    return (
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary-foreground/60" aria-label="Enviando">
        <circle cx="12" cy="12" r="9" /><path d="M12 8v4l2.5 2.5" />
      </svg>
    )
  }
  const isRead = status === 'read'
  const isDouble = status === 'delivered' || status === 'read'
  const cls = isRead ? 'text-sky-200' : 'text-primary-foreground/60'
  const label = isRead ? 'Lida' : isDouble ? 'Entregue' : 'Enviada'
  return (
    <svg
      width={isDouble ? 18 : 13}
      height="11"
      viewBox={isDouble ? '0 0 18 11' : '0 0 12 11'}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cls}
      aria-label={label}
    >
      <path d="M1 5.5 4.5 9 11 1.5" />
      {isDouble && <path d="M6 5.5 9.5 9 16 1.5" />}
    </svg>
  )
}

const WHATSAPP_WINDOW_MS = 24 * 60 * 60 * 1000

/**
 * Contagem regressiva da janela grátis de 24h da API oficial do WhatsApp:
 * a partir da última mensagem INBOUND (do cliente), a empresa pode
 * responder de graça com mensagem livre; passado isso, só com template
 * aprovado. `lastInboundAt` vem de whatsapp_conversations.last_inbound_at
 * (setado só no webhook, nunca no envio) — se nulo, a conversa nunca
 * recebeu mensagem do cliente e não há janela a contar.
 */
export function WindowBadge({ lastInboundAt, now }: { lastInboundAt?: string | null; now: number }) {
  if (!lastInboundAt) return null
  const inboundMs = new Date(lastInboundAt).getTime()
  if (isNaN(inboundMs)) return null
  const remainingMs = inboundMs + WHATSAPP_WINDOW_MS - now

  if (remainingMs <= 0) {
    return (
      <span
        className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border"
        title="Janela de 24h encerrada — só é possível responder com um template aprovado."
      >
        Janela fechada
      </span>
    )
  }

  const hours = Math.floor(remainingMs / 3_600_000)
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000)
  const label = hours > 0 ? `${hours}h${String(minutes).padStart(2, '0')}` : `${minutes}min`
  const urgent = remainingMs < 60 * 60_000 // menos de 1h restante

  return (
    <span
      className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${
        urgent
          ? 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
      }`}
      title="Tempo restante da janela grátis de 24h pra responder sem template."
    >
      {label}
    </span>
  )
}

// Horário do inbox no estilo WhatsApp: hoje → HH:MM, ontem → "Ontem",
// últimos 7 dias → dia da semana, mais antigo → DD/MM/AAAA.
export function formatInboxTime(iso?: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000)
  if (days <= 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// Alturas fixas pra "forma de onda" decorativa da barra de gravação (não é
// reativa ao áudio de verdade — só um efeito visual leve, tipo o do WhatsApp).
export const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => 6 + Math.round(10 * Math.abs(Math.sin(i * 0.7))))

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas).
export const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]
