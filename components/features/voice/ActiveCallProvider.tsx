'use client'

/**
 * Contexto persistente da chamada ativa — montado uma vez no layout da
 * organização (app/app/[orgSlug]/layout.tsx), então sobrevive à navegação
 * entre rotas do CRM (mesmo princípio de um provider de toast). Usa o
 * Twilio Voice SDK (carregado dinamicamente, só no browser) pra WebRTC:
 * o Device fica escutando `incoming` — o servidor conecta a chamada de
 * saída ao Client do agente assim que o destinatário atende (ver
 * app/api/webhooks/voice/twilio/answer/route.ts).
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'
import { getBrowserCallToken, hangupCall as hangupCallAction } from '@/actions/voice'

interface ActiveCall {
  voiceCallId: string
  name: string
  startedAt: number
  muted: boolean
}

interface ActiveCallContextValue {
  activeCall: ActiveCall | null
  placeCall: (opts: { voiceCallId: string; name: string }) => void
  hangup: () => void
  toggleMute: () => void
}

const ActiveCallContext = createContext<ActiveCallContextValue>({
  activeCall: null, placeCall: () => {}, hangup: () => {}, toggleMute: () => {},
})

export function useActiveCall() {
  return useContext(ActiveCallContext)
}

export function ActiveCallProvider({ orgSlug, identity, enabled, children }: { orgSlug: string; identity: string; enabled: boolean; children: React.ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null)
  const deviceRef = useRef<any>(null)
  const twilioConnectionRef = useRef<any>(null)

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    async function setupDevice() {
      const tokenRes = await getBrowserCallToken(orgSlug)
      if (!tokenRes.ok || cancelled) return
      const { Device } = await import('@twilio/voice-sdk')
      const device = new Device(tokenRes.token, { logLevel: 'error' })

      device.on('incoming', (connection: any) => {
        connection.accept()
        twilioConnectionRef.current = connection
        connection.on('disconnect', () => setActiveCall(null))
      })
      device.on('error', (err: any) => {
        console.error('[voice] Twilio Device error:', err)
      })

      await device.register()
      deviceRef.current = device
    }
    void setupDevice()
    return () => { cancelled = true; deviceRef.current?.destroy?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSlug, identity, enabled])

  const placeCall = useCallback((opts: { voiceCallId: string; name: string }) => {
    setActiveCall({ voiceCallId: opts.voiceCallId, name: opts.name, startedAt: Date.now(), muted: false })
  }, [])

  const hangup = useCallback(() => {
    if (!activeCall) return
    twilioConnectionRef.current?.disconnect?.()
    hangupCallAction(orgSlug, activeCall.voiceCallId).catch(() => {})
    setActiveCall(null)
  }, [activeCall, orgSlug])

  const toggleMute = useCallback(() => {
    setActiveCall(prev => {
      if (!prev) return prev
      const next = !prev.muted
      twilioConnectionRef.current?.mute?.(next)
      return { ...prev, muted: next }
    })
  }, [])

  return (
    <ActiveCallContext.Provider value={{ activeCall, placeCall, hangup, toggleMute }}>
      {children}
    </ActiveCallContext.Provider>
  )
}
