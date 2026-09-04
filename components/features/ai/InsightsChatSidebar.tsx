'use client'

/**
 * Session-list sidebar for InsightsChat. Prop-driven, split out of
 * InsightsChat.tsx.
 */

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles, Plus, Trash2, X } from 'lucide-react'

type Session = {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export function InsightsChatSidebar({
  orgSlug, hasApiKey, sessions, activeSessionId, mobileView, setMobileView, onNewSession, onDeleteSession,
}: {
  orgSlug: string
  hasApiKey: boolean
  sessions: Session[]
  activeSessionId: string
  mobileView: 'list' | 'chat'
  setMobileView: (v: 'list' | 'chat') => void
  onNewSession: () => void
  onDeleteSession: (id: string) => void
}) {
  return (
    <aside className={`w-full md:w-72 border-r bg-muted/20 flex-col ${mobileView === 'list' ? 'flex' : 'hidden'} md:flex`}>
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-sm">Insights IA</h2>
          <button
            type="button"
            onClick={() => setMobileView('chat')}
            className="md:hidden ml-auto p-1 rounded-md hover:bg-muted text-muted-foreground"
            aria-label="Fechar lista"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Pergunte qualquer coisa sobre seus dados.
        </p>
        <Button size="sm" className="w-full" onClick={onNewSession}>
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova conversa
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {sessions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">Sem conversas ainda.</p>
        ) : (
          sessions.map(s => {
            const active = s.id === activeSessionId
            return (
              <div
                key={s.id}
                className={`group rounded-md text-xs flex items-center justify-between gap-1 ${
                  active ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                }`}
              >
                <Link
                  href={`/app/${orgSlug}/insights?session=${s.id}`}
                  onClick={() => setMobileView('chat')}
                  className="flex-1 px-2 py-2 min-w-0"
                >
                  <div className="font-medium truncate">{s.title || 'Conversa'}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(s.updated_at).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => onDeleteSession(s.id)}
                  className="opacity-0 group-hover:opacity-100 hover:text-destructive p-2 transition-opacity"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })
        )}
      </div>

      <div className="p-3 border-t bg-card text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${hasApiKey ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-muted-foreground">
            API Anthropic: <strong>{hasApiKey ? 'configurada' : 'pendente'}</strong>
          </span>
        </div>
      </div>
    </aside>
  )
}
