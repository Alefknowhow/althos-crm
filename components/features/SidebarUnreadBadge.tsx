'use client'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

export default function SidebarUnreadBadge({ orgId, initialCount }: { orgId: string, initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  // Stable client reference — never recreated on re-renders.
  const supabaseRef = useRef(createClient())

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const supabase = supabaseRef.current
    const channel = supabase
      .channel(`whatsapp_sidebar_${orgId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'whatsapp_conversations', filter: `organization_id=eq.${orgId}` },
        () => {
          supabase
            .from('whatsapp_conversations')
            .select('unread_count')
            .eq('organization_id', orgId)
            .then(({ data }) => {
              if (data) setCount(data.reduce((a, b) => a + (b.unread_count || 0), 0))
            })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [orgId]) // supabase is stable via ref — not a dependency

  if (count === 0) return null
  return <Badge variant="destructive" className="ml-1 text-[10px] h-4 px-1 py-0 shadow-sm">{count}</Badge>
}
