'use client'

/**
 * Único ponto de entrada de click-to-call do CRM — aberto a partir de
 * Contatos (lista + header) e do LeadCard do Pipeline. Nunca duplicar esta
 * implementação: qualquer novo lugar que precise "ligar" deve reusar este
 * componente (ver useCallDialer()).
 */

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { PhoneCall } from 'lucide-react'
import { listOrgNumbers, listVoiceAgents, startCall } from '@/actions/voice'
import { useActiveCall } from './ActiveCallProvider'

interface DialTarget { contatoId?: string; name: string; phone: string }

const CallDialerContext = createContext<(target: DialTarget) => void>(() => {})

export function useCallDialer() {
  return useContext(CallDialerContext)
}

export function CallDialerProvider({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const [target, setTarget] = useState<DialTarget | null>(null)
  const [numbers, setNumbers] = useState<{ id: string; e164_number: string }[]>([])
  const [fromNumberId, setFromNumberId] = useState('')
  const [mode, setMode] = useState<'human' | 'ai'>('human')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [agentId, setAgentId] = useState('')
  const [starting, setStarting] = useState(false)
  const { placeCall } = useActiveCall()

  useEffect(() => {
    if (!target) return
    setMode('human')
    listOrgNumbers(orgSlug).then(res => {
      if (!res.ok) { toast.error(res.error); return }
      setNumbers(res.numbers as any)
      if (res.numbers[0]) setFromNumberId((res.numbers[0] as any).id)
    })
    listVoiceAgents(orgSlug).then(res => {
      if (res.ok) {
        setAgents(res.agents as any)
        if (res.agents[0]) setAgentId((res.agents[0] as any).id)
      }
    })
  }, [target, orgSlug])

  const open = useCallback((t: DialTarget) => setTarget(t), [])

  async function handleStart() {
    if (!target || !fromNumberId) return
    if (mode === 'ai' && !agentId) { toast.error('Selecione um agente de Voice AI.'); return }
    setStarting(true)
    const res = await startCall(orgSlug, { contatoId: target.contatoId, toNumber: target.phone, fromNumberId, aiAgentId: mode === 'ai' ? agentId : undefined })
    setStarting(false)
    if (!res.ok) { toast.error(res.error); return }
    if (mode === 'human') placeCall({ voiceCallId: res.voiceCallId, name: target.name })
    else toast.success('Voice AI iniciando a ligação...')
    setTarget(null)
  }

  return (
    <CallDialerContext.Provider value={open}>
      {children}
      <Dialog open={!!target} onOpenChange={v => !v && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{target?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{target?.phone}</p>

            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === 'human'} onChange={() => setMode('human')} /> Ligação humana
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" checked={mode === 'ai'} onChange={() => setMode('ai')} /> Voice AI
              </label>
            </div>

            {mode === 'ai' && (
              agents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum agente de Voice AI configurado. Crie um em Voice → Agentes de IA.</p>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs text-muted-foreground">Agente</label>
                  <ResponsiveSelect className="w-full" value={agentId} onValueChange={setAgentId} options={agents.map(a => ({ value: a.id, label: a.name }))} />
                </div>
              )
            )}

            {numbers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum número configurado. Configure um número em Voice → Números.
              </p>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs text-muted-foreground">Número de saída</label>
                <ResponsiveSelect
                  className="w-full"
                  value={fromNumberId}
                  onValueChange={setFromNumberId}
                  options={numbers.map(n => ({ value: n.id, label: n.e164_number }))}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full gap-1.5" disabled={starting || numbers.length === 0 || (mode === 'ai' && agents.length === 0)} onClick={handleStart}>
              <PhoneCall className="w-4 h-4" /> {starting ? 'Iniciando...' : mode === 'ai' ? 'Iniciar Voice AI' : 'Iniciar ligação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CallDialerContext.Provider>
  )
}
