'use client'

import { Button } from '@/components/ui/button'
import { PhoneCall, Send } from 'lucide-react'
import { useCallDialer } from './CallDialerModal'
import { useSmsComposer } from './SmsComposeModal'

/** Botões "Nova chamada"/"Novo SMS" dentro do próprio módulo Voice — abrem
 *  os mesmos modais globais (useCallDialer/useSmsComposer), sem contato
 *  pré-selecionado, deixando o usuário digitar o número na hora. */
export function VoiceInteractionsActions() {
  const dial = useCallDialer()
  const composeSms = useSmsComposer()

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => composeSms({ name: '', phone: '' })}>
        <Send className="w-3.5 h-3.5" /> Novo SMS
      </Button>
      <Button size="sm" className="gap-1.5" onClick={() => dial({ name: '', phone: '' })}>
        <PhoneCall className="w-3.5 h-3.5" /> Nova chamada
      </Button>
    </div>
  )
}
