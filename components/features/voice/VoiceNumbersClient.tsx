'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog'
import { Plus } from 'lucide-react'
import { listAvailableNumbers, purchaseNumber } from '@/actions/voice'

export function VoiceNumbersClient({ orgSlug }: { orgSlug: string }) {
  const [open, setOpen] = useState(false)
  const [areaCode, setAreaCode] = useState('BR')
  const [results, setResults] = useState<{ e164Number: string; friendlyName: string }[]>([])
  const [searching, startSearch] = useTransition()
  const [purchasing, startPurchase] = useTransition()

  function handleSearch() {
    startSearch(async () => {
      const res = await listAvailableNumbers(orgSlug, areaCode)
      if (!res.ok) { toast.error(res.error); return }
      setResults(res.numbers)
    })
  }

  function handlePurchase(e164: string) {
    startPurchase(async () => {
      const res = await purchaseNumber(orgSlug, e164)
      if (!res.ok) { toast.error(res.error); return }
      toast.success('Número adicionado.')
      setOpen(false)
      window.location.reload()
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Plus className="w-4 h-4" /> Adicionar número</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo número</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={areaCode} onChange={e => setAreaCode(e.target.value)} placeholder="DDD ou país (ex.: 47, BR)" />
            <Button variant="outline" onClick={handleSearch} disabled={searching}>{searching ? 'Buscando...' : 'Buscar'}</Button>
          </div>
          {results.length > 0 && (
            <div className="divide-y rounded-md border max-h-64 overflow-auto">
              {results.map(n => (
                <div key={n.e164Number} className="flex items-center justify-between p-2.5 text-sm">
                  <span>{n.e164Number}</span>
                  <Button size="sm" variant="outline" disabled={purchasing} onClick={() => handlePurchase(n.e164Number)}>Adicionar</Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter />
      </DialogContent>
    </Dialog>
  )
}
