'use client'

import { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { updateTemplate, sendTestEmail } from '@/actions/emails'

// Tiptap loads only client-side and adds ~150KB; dynamic-import keeps the
// initial bundle clean for everyone else.
const TiptapEmailEditor = dynamic(
  () => import('@/components/features/email/TiptapEmailEditor'),
  { ssr: false, loading: () => <div className="h-64 border rounded-md bg-muted/20 animate-pulse" /> },
)

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

export default function EmailTemplateEditor({ orgSlug, initialTemplate, sampleLead, org }: any) {
  const [template, setTemplate] = useState(initialTemplate)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const variables = useMemo(() => {
    const lead = sampleLead || { name: 'Exemplo da Silva', email: 'exemplo@email.com', phone: '(11) 99999-9999', custom_fields: { cargo: 'CEO' } }
    return {
      lead: { name: lead.name, email: lead.email, phone: lead.phone },
      org: { name: org.name },
      custom: lead.custom_fields || {}
    }
  }, [sampleLead, org])

  const previewSubject = renderTemplate(template.subject || '', variables)
  const previewHtml = renderTemplate(template.body_html || '', variables)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await updateTemplate(orgSlug, template.id, {
        name: template.name,
        subject: template.subject,
        body_html: template.body_html,
      })
      if ((res as any)?.ok === false) {
        toast.error((res as any).error || 'Erro ao salvar')
      } else {
        toast.success('Template salvo')
      }
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function handleTest() {
    setTesting(true)
    const res = await sendTestEmail(orgSlug, template.id)
    setTesting(false)
    if (res.ok) toast.success('E-mail de teste enviado!')
    else toast.error('Erro: ' + res.error)
  }

  return (
    <div className="flex flex-col lg:flex-row w-full h-full bg-background text-foreground overflow-y-auto lg:overflow-hidden">
      <div className="w-full lg:w-1/2 border-b lg:border-b-0 lg:border-r flex flex-col lg:h-full">
        <div className="p-3 sm:p-4 border-b flex flex-wrap justify-between items-center gap-2 shadow-sm shrink-0">
          <Input value={template.name} onChange={e => setTemplate({...template, name: e.target.value})} className="font-bold border-transparent hover:border-input focus:border-input flex-1 min-w-0 lg:w-1/2 lg:flex-none" />
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>{testing ? 'Enviando...' : <><span className="hidden sm:inline">Enviar Teste pra mim</span><span className="sm:hidden">Testar</span></>}</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 lg:overflow-y-auto lg:flex-1 space-y-6">
          <div className="space-y-2">
            <Label>Assunto</Label>
            <Input value={template.subject || ''} onChange={e => setTemplate({...template, subject: e.target.value})} />
          </div>

          <div className="space-y-2 flex-1 flex flex-col min-h-[300px]">
            <Label>Corpo do E-mail</Label>
            <TiptapEmailEditor
              orgSlug={orgSlug}
              value={template.body_html || ''}
              onChange={(html) => setTemplate({ ...template, body_html: html })}
              placeholder="Olá {{lead.name}}, ..."
            />
          </div>

          <div className="bg-muted p-4 rounded-xl text-sm space-y-2">
            <div className="font-semibold text-muted-foreground">Variáveis Disponíveis:</div>
            <div className="flex flex-wrap gap-2">
              {['{{lead.name}}', '{{lead.email}}', '{{lead.phone}}', '{{org.name}}', '{{custom.X}}'].map(v => (
                <code key={v} className="bg-background px-2 py-1 rounded border text-xs text-primary font-medium">{v}</code>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="w-full lg:w-1/2 bg-muted/30 flex flex-col relative lg:h-full">
        <div className="p-4 border-b bg-background/50 backdrop-blur-sm shadow-sm flex items-center justify-center shrink-0 z-10">
          <span className="text-sm font-medium text-muted-foreground">Preview ao vivo (usando {sampleLead?.name || 'dados de exemplo'})</span>
        </div>
        
        <div className="lg:flex-1 p-4 sm:p-8 lg:overflow-y-auto flex justify-center items-start hide-scrollbar">
          <div className="w-full max-w-2xl bg-white border rounded-xl shadow-xl overflow-hidden text-black ring-1 ring-black/5">
             <div className="p-4 border-b bg-gray-50/80 flex flex-col gap-1.5 backdrop-blur-sm">
               <div className="text-sm flex"><span className="text-gray-400 w-16 shrink-0 inline-block font-medium">De:</span> <span className="truncate">{org.email_from_address || 'onboarding@resend.dev'}</span></div>
               <div className="text-sm flex"><span className="text-gray-400 w-16 shrink-0 inline-block font-medium">Para:</span> <span className="truncate">{variables.lead.email}</span></div>
               <div className="text-sm mt-3 pt-3 border-t border-gray-200 font-semibold text-gray-900">{previewSubject || '(sem assunto)'}</div>
             </div>
             <div className="p-6" dangerouslySetInnerHTML={{ __html: previewHtml }} />
          </div>
        </div>
      </div>
    </div>
  )
}
