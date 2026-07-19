'use client'

import { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { queueEmailForLead } from '@/actions/emails'
import { Mail } from 'lucide-react'
import { toast } from 'sonner'
import { traduzirErro } from '@/lib/utils/error-translator'

function renderTemplate(templateStr: string, variables: any) {
  if (!templateStr) return ''
  return templateStr.replace(/\{\{(.*?)\}\}/g, (match, path) => {
    const keys = path.trim().split('.')
    let val = variables
    for (const key of keys) {
      if (val === undefined || val === null) return ''
      val = val[key]
    }
    return val !== undefined && val !== null ? String(val) : ''
  })
}

export default function SendEmailDialog({ orgSlug, lead, templates, org }: any) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('')

  const template = useMemo(() => templates.find((t:any) => t.id === selectedTemplateId), [selectedTemplateId, templates])

  const variables = useMemo(() => {
    return {
      lead: { name: lead.name, email: lead.email, phone: lead.phone },
      org: { name: org.name },
      custom: lead.custom_fields || {}
    }
  }, [lead, org])

  const previewSubject = renderTemplate(template?.subject || '', variables)
  const previewHtml = renderTemplate(template?.body_html || '', variables)

  async function handleSend() {
    if (!selectedTemplateId) { toast.error('Selecione um template'); return }
    if (!lead.email) { toast.error('Lead não tem e-mail. Adicione um e-mail antes de enviar.'); return }

    setLoading(true)
    const res = await queueEmailForLead(orgSlug, lead.id, selectedTemplateId, lead.email)
    setLoading(false)
    if (res.ok) setOpen(false)
    else toast.error(traduzirErro(res.error))
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="flex gap-2 items-center">
        <Mail className="w-4 h-4" /> Enviar E-mail
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Enviar E-mail para {lead.name}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-0 flex-1 min-h-0">
            <div className="w-1/3 flex flex-col gap-6 border-r p-6 bg-muted/10 overflow-y-auto">
              <div className="space-y-2">
                <Label>Para</Label>
                <div className="h-9 flex items-center px-3 border rounded-md bg-muted/50 text-sm font-medium">{lead.email || 'Sem e-mail (impossível enviar)'}</div>
              </div>
              <div className="space-y-2">
                <Label>Template</Label>
                <select className="w-full h-9 border rounded-md px-3 text-sm bg-background cursor-pointer" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                  <option value="">Selecione...</option>
                  {templates.map((t:any) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              
              <div className="mt-auto pt-4 border-t">
                 <Button className="w-full" onClick={handleSend} disabled={loading || !selectedTemplateId || !lead.email}>
                  {loading ? 'Enfileirando disparo...' : 'Confirmar Envio'}
                </Button>
              </div>
            </div>

            <div className="w-2/3 flex flex-col bg-muted/30 relative">
              <div className="p-4 border-b bg-background/50 flex justify-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Preview Visual</div>
              {template ? (
                <div className="flex-1 overflow-y-auto p-8 hide-scrollbar">
                  <div className="border rounded-none overflow-hidden   bg-white ring-1 ring-black/5 flex flex-col h-full min-h-[400px]">
                    <div className="p-4 border-b bg-gray-50 text-black shrink-0">
                      <div className="font-semibold text-lg">{previewSubject}</div>
                    </div>
                    <div className="p-6 flex-1 text-black bg-white" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8">
                  <div className="border-2 border-dashed rounded-none w-full h-full flex flex-col items-center justify-center text-muted-foreground gap-4 text-sm bg-background/50">
                    <Mail className="w-8 h-8 opacity-20" />
                    Selecione um template para ver o preview do disparo
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
