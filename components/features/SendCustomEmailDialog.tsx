'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { sendCustomEmailToLead } from '@/actions/emails'
import { Send } from 'lucide-react'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

type Lead = { id: string; name: string; email?: string | null }

/**
 * Envio avulso — sem escolher um template, escreve assunto/corpo na hora.
 * Complementa o SendEmailDialog (que exige um template do sistema).
 */
export default function SendCustomEmailDialog({ orgSlug, lead, trigger }: { orgSlug: string; lead: Lead; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  async function handleSend() {
    if (!lead.email) { toast.error('Lead não tem e-mail. Adicione um e-mail antes de enviar.'); return }
    if (!subject.trim()) { toast.error('Informe um assunto'); return }

    setLoading(true)
    const bodyHtml = body.split('\n').map(line => `<p>${line || '&nbsp;'}</p>`).join('')
    const res = await sendCustomEmailToLead(orgSlug, lead.id, lead.email, subject, bodyHtml)
    setLoading(false)
    if (res.ok) {
      toast.success('E-mail enfileirado para envio')
      setOpen(false)
      setSubject('')
      setBody('')
    } else {
      toast.error(traduzirErro(res.error))
    }
  }

  return (
    <>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="flex gap-2 items-center">
          <Send className="w-4 h-4" /> Enviar e-mail
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar e-mail para {lead.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Para</Label>
              <div className="h-9 flex items-center px-3 border rounded-md bg-muted/50 text-sm font-medium">
                {lead.email || 'Sem e-mail (impossível enviar)'}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Assunto</Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Assunto do e-mail" />
            </div>
            <div className="space-y-2">
              <Label>Mensagem</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Escreva sua mensagem..." rows={8} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSend} disabled={loading || !subject.trim() || !lead.email}>
              {loading ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
