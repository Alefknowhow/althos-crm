'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import Link from 'next/link'
import {
  syncGoogleBusinessReviews, replyToGoogleReview, deleteGoogleReviewReply,
  type GoogleBusinessLocation, type GoogleBusinessReview,
} from '@/actions/google-business'
import { Star, RefreshCw, MapPin, MessageSquare, Trash2, Send } from 'lucide-react'

function Stars({ rating }: { rating: number | null }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${rating && i < rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
    </div>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function ReviewCard({ orgSlug, review }: { orgSlug: string; review: GoogleBusinessReview }) {
  const router = useRouter()
  const [replyText, setReplyText] = useState(review.reply_comment || '')
  const [editing, setEditing] = useState(!review.reply_comment)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleSave() {
    setSaving(true)
    const res = await replyToGoogleReview(orgSlug, review.id, replyText)
    setSaving(false)
    if (res.ok) { toast.success('Resposta publicada'); setEditing(false); router.refresh() }
    else toast.error(res.error)
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deleteGoogleReviewReply(orgSlug, review.id)
    setDeleting(false)
    if (res.ok) { toast.success('Resposta removida'); setReplyText(''); setEditing(true); router.refresh() }
    else toast.error(res.error)
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        {review.reviewer_photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={review.reviewer_photo_url} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-muted grid place-items-center text-xs font-semibold shrink-0">
            {(review.reviewer_name || '?').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium">{review.reviewer_name || 'Anônimo'}</p>
            <Stars rating={review.star_rating} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{formatDate(review.create_time)}</p>
        </div>
      </div>

      {review.comment && <p className="text-sm leading-relaxed whitespace-pre-wrap">{review.comment}</p>}

      {!editing && review.reply_comment ? (
        <div className="rounded-lg bg-muted/40 p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-muted-foreground">Sua resposta</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>Editar</Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          <p className="text-sm whitespace-pre-wrap">{review.reply_comment}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            rows={2}
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            placeholder="Escreva uma resposta pública a essa avaliação..."
            className="text-sm resize-y"
          />
          <div className="flex justify-end gap-2">
            {review.reply_comment && (
              <Button variant="ghost" size="sm" onClick={() => { setEditing(false); setReplyText(review.reply_comment || '') }}>
                Cancelar
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving || !replyText.trim()}>
              <Send className="w-3.5 h-3.5 mr-1.5" /> {saving ? 'Enviando...' : 'Responder'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ReviewsClient({
  orgSlug, locations, activeLocationId, initialReviews,
}: {
  orgSlug: string
  locations: GoogleBusinessLocation[]
  activeLocationId: string | null
  initialReviews: GoogleBusinessReview[]
}) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)
  const [, startTransition] = useTransition()

  function handleLocationChange(id: string) {
    startTransition(() => {
      router.push(`/app/${orgSlug}/avaliacoes?location=${id}`)
    })
  }

  async function handleSync() {
    if (!activeLocationId) return
    setSyncing(true)
    const res = await syncGoogleBusinessReviews(orgSlug, activeLocationId)
    setSyncing(false)
    if (res.ok) { toast.success(`${res.count} avaliação(ões) sincronizada(s)`); router.refresh() }
    else toast.error(res.error)
  }

  if (locations.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4 rounded-lg border border-dashed">
        <div className="w-12 h-12 rounded-none grid place-items-center bg-blue-50 text-blue-600 mb-3">
          <MapPin className="w-6 h-6" />
        </div>
        <p className="text-sm font-medium">Nenhuma unidade vinculada</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          Conecte o Google Business e vincule uma unidade em Configurações pra ver as avaliações aqui.
        </p>
        <Button size="sm" className="mt-4" asChild>
          <Link href={`/app/${orgSlug}/configuracoes/google-business`}>Ir para Configurações</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {locations.length > 1 ? (
          <select
            className="h-9 rounded-md border bg-background px-2 text-sm"
            value={activeLocationId ?? ''}
            onChange={e => handleLocationChange(e.target.value)}
          >
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.title || l.google_location_id}</option>
            ))}
          </select>
        ) : (
          <p className="text-sm font-medium flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-muted-foreground" /> {locations[0].title || locations[0].google_location_id}
          </p>
        )}
        <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${syncing ? 'animate-spin' : ''}`} /> Sincronizar
        </Button>
      </div>

      {initialReviews.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-4 rounded-lg border border-dashed">
          <MessageSquare className="w-8 h-8 text-muted-foreground mb-2" />
          <p className="text-sm font-medium">Nenhuma avaliação sincronizada ainda</p>
          <p className="text-xs text-muted-foreground mt-1">Clique em "Sincronizar" pra buscar as avaliações do Google.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {initialReviews.map(r => <ReviewCard key={r.id} orgSlug={orgSlug} review={r} />)}
        </div>
      )}
    </div>
  )
}
