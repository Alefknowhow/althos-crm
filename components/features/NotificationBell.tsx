'use client'

import * as React from 'react'
import { Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'

interface NotificationBellProps {
  orgId: string
  userId: string
}

export default function NotificationBell({ orgId, userId }: NotificationBellProps) {
  // Realtime implementation commented for next mission
  /*
  const supabase = createClient()
  useEffect(() => {
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `organization_id=eq.${orgId}`
      }, (payload) => {
        // handle update
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [orgId])
  */

  const [unreadCount, setUnreadCount] = React.useState(0)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] rounded-full border-2 border-background"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-4 flex items-center justify-between">
          <h4 className="font-semibold text-sm">Notificações</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-auto p-0 text-xs text-muted-foreground hover:text-primary">
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <Separator />
        <ScrollArea className="h-[300px]">
          <div className="p-4 text-center space-y-2">
            <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center mx-auto mb-2">
              <Bell className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Nenhuma notificação por enquanto</p>
            <p className="text-xs text-muted-foreground">
              Avisaremos você quando houver novidades em seus leads ou automações.
            </p>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
