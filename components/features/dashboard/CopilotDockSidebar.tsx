'use client'

/**
 * Conversation-history sidebar for CopilotDock. Prop-driven, split out
 * of CopilotDock.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { X, Plus, Pencil, Check, Trash2 } from 'lucide-react'

type SessionSummary = { id: string; title: string | null; created_at: string; updated_at: string }

function formatSessionDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

export function CopilotDockSidebar({
  sidebarOpen, setSidebarOpen, sessions, sessionId, renamingId, renameValue, setRenameValue,
  onNewConversation, onSwitchSession, onStartRename, onConfirmRename, onCancelRename, onDeleteSession,
}: {
  sidebarOpen: boolean
  setSidebarOpen: (v: boolean) => void
  sessions: SessionSummary[]
  sessionId: string | null
  renamingId: string | null
  renameValue: string
  setRenameValue: (v: string) => void
  onNewConversation: () => void
  onSwitchSession: (id: string) => void
  onStartRename: (s: SessionSummary) => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onDeleteSession: (id: string) => void
}) {
  return (
    <>
      {sidebarOpen && (
        <div
          className="absolute inset-0 z-20 bg-black/40 sm:hidden animate-in fade-in duration-150"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div
        className={
          sidebarOpen
            ? 'shrink-0 border-r bg-muted/30 flex flex-col overflow-hidden absolute inset-y-0 left-0 z-30 w-[85%] max-w-[320px] translate-x-0 transition-transform duration-200 ease-out sm:static sm:z-auto sm:w-[260px] sm:max-w-none sm:translate-x-0'
            : 'shrink-0 border-r bg-muted/30 hidden overflow-hidden absolute inset-y-0 left-0 z-30 w-[85%] max-w-[320px] -translate-x-full transition-transform duration-200 ease-out sm:flex sm:flex-col sm:static sm:z-auto sm:w-0 sm:max-w-none sm:translate-x-0'
        }
      >
        <div className="h-16 shrink-0 flex items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">Conversas</span>
          <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg sm:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="px-3 pb-2">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 rounded-xl h-9 text-sm font-normal border-border/70 hover:bg-background"
            onClick={onNewConversation}
          >
            <Plus className="w-4 h-4" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 space-y-0.5">
          {sessions.map(s => (
            <div
              key={s.id}
              className={`group flex items-center gap-1 rounded-xl px-2.5 py-2 text-sm cursor-pointer transition-colors ${
                s.id === sessionId ? 'bg-background shadow-sm' : 'hover:bg-background/70'
              }`}
              onClick={() => renamingId !== s.id && onSwitchSession(s.id)}
            >
              {renamingId === s.id ? (
                <>
                  <Input
                    autoFocus
                    value={renameValue}
                    onChange={e => setRenameValue(e.target.value)}
                    onClick={e => e.stopPropagation()}
                    onKeyDown={e => { if (e.key === 'Enter') onConfirmRename(); if (e.key === 'Escape') onCancelRename() }}
                    className="h-7 text-xs flex-1 rounded-lg"
                  />
                  <Button variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg" onClick={e => { e.stopPropagation(); onConfirmRename() }}>
                    <Check className="w-3.5 h-3.5" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="truncate leading-tight">{s.title || 'Nova conversa'}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{formatSessionDate(s.updated_at)}</p>
                  </div>
                  <Button
                    variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg opacity-0 group-hover:opacity-100"
                    onClick={e => { e.stopPropagation(); onStartRename(s) }}
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="w-6 h-6 shrink-0 rounded-lg opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                    onClick={e => { e.stopPropagation(); onDeleteSession(s.id) }}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </>
              )}
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">Nenhuma conversa ainda.</p>
          )}
        </div>
      </div>
    </>
  )
}
