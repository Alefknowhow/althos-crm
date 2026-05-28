'use client'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

export default function SidebarUnreadBadge({ orgId, initialCount }: { orgId: string, initialCount: number }) {
  const [count, setCount] = useState(initialCount)
  const supabase = createClient()

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const channel = supabase.channel('whatsapp_sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` }, (payload: any) => {
        supabase.from('whatsapp_conversations').select('unread_count').eq('organization_id', orgId).then(({ data }) => {
          if (data) {
             const sum = data.reduce((a, b) => a + (b.unread_count || 0), 0)
             setCount(sum)
          }
        })
      }).subscribe()
      
    return () => { supabase.removeChannel(channel) }
  }, [orgId, supabase])

  if (count === 0) return null
  return <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1 py-0 shadow-sm">{count}</Badge>
}
