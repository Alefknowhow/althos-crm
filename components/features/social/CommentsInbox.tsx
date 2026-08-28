'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { MessageSquareText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { replyToCommentManually, type PendingComment } from '@/actions/social-comments'

/**
 * Fila de resposta manual a comentários do Instagram que não bateram em
 * nenhuma automação (ver lib/social/engine.ts:logPendingComment). É o
 * complemento manual da automação de comentários já existente — mesma ideia
 * do Direct Inbox pra DMs, incluindo tempo real (comentário novo entra na
 * fila sem precisar recarregar a página).
 */
export default function CommentsInbox({ orgSlug, orgId, initialComments }: { orgSlug: string; orgId?: string; initialComments: PendingComment[] }) {
  const [comments, setComments] = useState(initialComments)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [alsoDm, setAlsoDm] = useState<Record<string, boolean>>({})
  const [pending, startTransition] = useTransition()
  const [sendingId, setSendingId] = useState<string | null>(null)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => { setComments(initialComments) }, [initialComments])

  useEffect(() => {
    if (!orgId) return
    const channel = supabase
      .channel(`social_comments_pending_${orgId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'social_interactions', filter: `organization_id=eq.${orgId}` },
        payload => {
          const row = payload.new as any
          if (row.platform !== 'instagram' || row.interaction_type !== 'comment' || row.response_type) return
          const commentId = row.raw_payload?.commentId as string | undefined
          if (!commentId) return
          setComments(prev => prev.some(c => c.id === row.id) ? prev : [
            {
              id: row.id,
              sender_username: row.sender_username,
              sender_name: row.sender_name,
              inbound_text: row.inbound_text,
              post_id: row.post_id,
              created_at: row.created_at,
              comment_id: commentId,
            },
            ...prev,
          ])
        },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase])

  function handleReply(id: string) {
    const text = (drafts[id] || '').trim()
    if (!text) return
    setSendingId(id)
    startTransition(async () => {
      const res = await replyToCommentManually(orgSlug, id, text, !!alsoDm[id])
      setSendingId(null)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Resposta publicada')
      setComments(prev => prev.filter(c => c.id !== id))
    })
  }

  if (comments.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center text-muted-foreground">
        <MessageSquareText className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium">Nenhum comentário pendente</p>
        <p className="text-xs mt-1">
          Comentários que não batem em nenhuma automação aparecem aqui pra
          resposta manual.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6 space-y-4">
      {comments.map(c => (
        <div key={c.id} className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">
              {c.sender_name || (c.sender_username ? `@${c.sender_username}` : 'Comentário')}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(c.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <p className="text-sm bg-muted/40 rounded-md p-2.5">{c.inbound_text}</p>
          <Textarea
            placeholder="Escreva a resposta pública..."
            value={drafts[c.id] || ''}
            onChange={e => setDrafts(prev => ({ ...prev, [c.id]: e.target.value }))}
            className="min-h-[70px]"
          />
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <Checkbox
                checked={!!alsoDm[c.id]}
                onCheckedChange={v => setAlsoDm(prev => ({ ...prev, [c.id]: !!v }))}
              />
              Também enviar como DM privada
            </label>
            <Button
              size="sm"
              disabled={pending && sendingId === c.id}
              onClick={() => handleReply(c.id)}
            >
              {pending && sendingId === c.id ? 'Enviando...' : 'Responder'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}
