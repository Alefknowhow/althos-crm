'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Loader2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationRow,
} from '@/actions/notifications'

interface NotificationBellProps {
  orgSlug: string
  orgId: string
  userId: string
}

export default function NotificationBell({ orgSlug, orgId, userId }: NotificationBellProps) {
  const router = useRouter()
  const [items, setItems] = React.useState<NotificationRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [open, setOpen] = React.useState(false)

  const unreadCount = React.useMemo(
    () => items.filter(n => !n.read_at).length,
    [items],
  )

  const refresh = React.useCallback(async () => {
    try {
      const data = await listNotifications(orgSlug)
      setItems(data)
    } finally {
      setLoading(false)
    }
  }, [orgSlug])

  // Initial load + realtime subscription for new notifications in this org.
  React.useEffect(() => {
    refresh()

    const supabase = createClient()
    const channel = supabase
      .channel(`notifications-${orgId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `organization_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as NotificationRow & { user_id: string | null }
          // Only surface rows addressed to me or to the whole org.
          if (row.user_id && row.user_id !== userId) return
          setItems(prev =>
            prev.some(n => n.id === row.id) ? prev : [row, ...prev],
          )
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [orgId, userId, refresh])

  async function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next) refresh()
  }

  async function handleClick(n: NotificationRow) {
    // Optimistic mark-as-read.
    if (!n.read_at) {
      setItems(prev =>
        prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)),
      )
      markNotificationRead(orgSlug, n.id)
    }
    if (n.link) {
      setOpen(false)
      router.push(n.link)
    }
  }

  async function handleMarkAll() {
    const now = new Date().toISOString()
    setItems(prev => prev.map(x => (x.read_at ? x : { ...x, read_at: now })))
    await markAllNotificationsRead(orgSlug)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 flex items-center justify-center text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMarkAll}
              className="h-auto p-0 text-xs text-muted-foreground hover:text-primary"
            >
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[320px]">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
            </div>
          ) : items.length === 0 ? (
            <div className="p-4 text-center space-y-2">
              <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
                <Bell className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhuma notificação por enquanto</p>
              <p className="text-xs text-muted-foreground">
                Avisaremos você quando houver novidades em seus leads ou automações.
              </p>
            </div>
          ) : (
            <ul className="divide-y">
              {items.map(n => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => handleClick(n)}
                    className={`w-full text-left px-4 py-3 transition-colors hover:bg-muted/50 ${
                      n.read_at ? '' : 'bg-primary/5'
                    } ${n.link ? 'cursor-pointer' : 'cursor-default'}`}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read_at && (
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                      )}
                      <div className={`min-w-0 flex-1 ${n.read_at ? 'pl-4' : ''}`}>
                        <p className="text-sm font-medium leading-snug">{n.title}</p>
                        {n.content && (
                          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                            {n.content}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] text-muted-foreground/70">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
