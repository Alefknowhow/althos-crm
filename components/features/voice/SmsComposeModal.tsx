'use client'

import { useEffect, useState, createContext, useContext, useCallback } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ResponsiveSelect } from '@/components/ui/responsive-select'
import { Send } from 'lucide-react'
import { listOrgNumbers, sendSMS } from '@/actions/voice'

interface SmsTarget { contatoId?: string; name: string; phone: string }

const SmsComposeContext = createContext<(target: SmsTarget) => void>(() => {})

export function useSmsComposer() {
  return useContext(SmsComposeContext)
}

export function SmsComposeProvider({ orgSlug, children }: { orgSlug: string; children: React.ReactNode }) {
  const [target, setTarget] = useState<SmsTarget | null>(null)
  const [numbers, setNumbers] = useState<{ id: string; e164_number: string }[]>([])
  const [fromNumberId, setFromNumberId] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!target) return
    setBody('')
    listOrgNumbers(orgSlug).then(res => {
      if (!res.ok) { toast.error(res.error); return }
      setNumbers(res.numbers as any)
      if (res.numbers[0]) setFromNumberId((res.numbers[0] as any).id)
    })
  }, [target, orgSlug])

  const open = useCallback((t: SmsTarget) => setTarget(t), [])

  async function handleSend() {
    if (!target || !fromNumberId || !body.trim()) return
    setSending(true)
    const res = await sendSMS(orgSlug, { contatoId: target.contatoId, toNumber: target.phone, fromNumberId, body: body.trim() })
    setSending(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success('SMS enviado.')
    setTarget(null)
  }

  return (
    <SmsComposeContext.Provider value={open}>
      {children}
      <Dialog open={!!target} onOpenChange={v => !v && setTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>SMS para {target?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {numbers.length > 0 && (
              <ResponsiveSelect className="w-full" value={fromNumberId} onValueChange={setFromNumberId} options={numbers.map(n => ({ value: n.id, label: n.e164_number }))} />
            )}
            <textarea
              value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Mensagem..."
              rows={4}
              className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
            />
          </div>
          <DialogFooter>
            <Button className="w-full gap-1.5" disabled={sending || numbers.length === 0 || !body.trim()} onClick={handleSend}>
              <Send className="w-4 h-4" /> {sending ? 'Enviando...' : 'Enviar SMS'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SmsComposeContext.Provider>
  )
}
