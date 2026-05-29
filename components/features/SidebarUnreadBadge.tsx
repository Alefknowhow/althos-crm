'use client'
import { useEffect, useId, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'

export default function SidebarUnreadBadge({ orgId, initialCount }: { orgId: string, initialCount: number }) {
  const [count, setCount] = useState(initialCount)

  // createBrowserClient (@supabase/ssr) is a singleton — every call returns the
  // same instance. We keep a ref here so supabase is never listed in useEffect
  // deps (it's stable by design).
  const supabaseRef = useRef(createClient())

  // useId gives a unique, stable id per component instance. SidebarShell
  // renders children twice (desktop aside + mobile drawer), producing two
  // SidebarUnreadBadge instances that share the singleton Supabase client.
  // Without a unique name the second instance calls .on() on the already-
  // subscribed channel and crashes. The suffix makes each channel unique.
  const instanceId = useId()

  useEffect(() => {
    setCount(initialCount)
  }, [initialCount])

  useEffect(() => {
    const supabase = supabaseRef.current
    // Replace React's ":r0:" style colons — Supabase channel names must not
    // contain colons.
    const safeSuffix = instanceId.replace(/:/g, '')
    const channel = supabase
      .channel(`whatsapp_sidebar_${orgId}_${safeSuffix}`)
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
