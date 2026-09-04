import { FileText } from 'lucide-react'
import type { SocialMessageRow } from '@/actions/social-inbox'

/**
 * Pure presentational helpers for SocialInbox — no state, no client-only
 * APIs. Split out of SocialInbox.tsx.
 */

// Conjunto enxuto de emojis comuns para atendimento (sem libs externas) —
// mesmo padrão usado no WhatsappChat.tsx.
export const EMOJIS = [
  '😀','😁','😂','🤣','😊','😍','😘','😎','🤗','🤔','😅','😉','🙂','😇','🥳','😏',
  '👍','👎','👏','🙏','💪','🤝','👋','✌️','🤙','👌','🫶','💯','🔥','✨','⭐','🎉',
  '❤️','🧡','💛','💚','💙','💜','🤍','💔','😢','😭','😅','😡','😱','🤯','🥺','😴',
  '✅','❌','⚠️','📌','📎','📷','🎁','💰','💳','🛫','🏨','🌴','🗺️','📅','⏰','📞',
]

// Alturas fixas pra "forma de onda" decorativa da barra de gravação — mesma
// do WhatsappChat.tsx.
export const WAVEFORM_BARS = Array.from({ length: 40 }, (_, i) => 6 + Math.round(10 * Math.abs(Math.sin(i * 0.7))))

export function Avatar({ name, username, avatarUrl, size = 'md' }: { name: string | null; username: string | null; avatarUrl: string | null; size?: 'md' | 'lg' }) {
  const label = name || username || '?'
  const initials = label.slice(0, 2).toUpperCase()
  const dim = size === 'lg' ? 'h-14 w-14' : 'h-11 w-11'
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={label} className={`${dim} rounded-full object-cover shrink-0`} />
  }
  return (
    <div className={`${dim} rounded-full bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#4f5bd5] text-white flex items-center justify-center text-xs font-semibold shrink-0`}>
      {initials}
    </div>
  )
}

// Tick de confirmação ao lado do horário — mesmas regras do WhatsappChat,
// sem o estado "lida" (Instagram manda read/delivery mas não temos double-
// check azul específico no design daqui; reaproveita as mesmas cores).
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

// Horário do inbox no estilo WhatsApp — mesma função do WhatsappChat.tsx.
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

// Renderiza a mídia de uma mensagem, dispatch por media_type.
export function renderInstagramMedia(m: SocialMessageRow, onImageClick?: (url: string) => void): React.ReactNode {
  if (!m.media_url) return null
  const type = m.media_type || 'image'
  if (type === 'image') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={m.media_url} alt="" className="max-w-full rounded-2xl mb-1 max-h-64 object-cover cursor-pointer"
        onClick={() => onImageClick?.(m.media_url!)}
      />
    )
  }
  if (type === 'video') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <video controls src={m.media_url} className="rounded-2xl max-w-full max-h-64 mb-1" />
  }
  if (type === 'audio') {
    // eslint-disable-next-line jsx-a11y/media-has-caption
    return <audio controls src={m.media_url} className="max-w-[220px] mb-1" />
  }
  return (
    <a href={m.media_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 underline mb-1">
      <FileText className="w-4 h-4 shrink-0" />
      <span className="truncate">Documento</span>
    </a>
  )
}
