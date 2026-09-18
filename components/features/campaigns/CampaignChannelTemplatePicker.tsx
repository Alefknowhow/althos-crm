'use client'

/** Seletor de canais (WhatsApp/e-mail/SMS, múltipla escolha) + template de
 *  cada canal selecionado — extraído de NewCampaignForm.tsx só por tamanho
 *  de arquivo. SMS ainda não tem envio de campanha implementado (só
 *  telefonia/Voice via Twilio) — aparece desabilitado, "em breve". */

import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MessageSquare, Mail, Smartphone } from 'lucide-react'

export type SendChannel = 'whatsapp' | 'email' | 'sms'

type WaTemplate = { id: string; name: string; display_name: string; language: string; status: string }
type EmailTemplate = { id: string; name: string; subject: string | null; category: string | null }

const WA_STATUS_LABEL: Record<string, string> = {
  approved: 'Aprovado',
  pending:  'Pendente',
  local:    'Local',
}

export default function CampaignChannelTemplatePicker({
  channels, toggleChannel, waTemplateId, setWaTemplateId, emailTemplateId, setEmailTemplateId,
  waTemplates, emailTemplates,
}: {
  channels: SendChannel[]
  toggleChannel: (c: SendChannel) => void
  waTemplateId: string
  setWaTemplateId: (v: string) => void
  emailTemplateId: string
  setEmailTemplateId: (v: string) => void
  waTemplates: WaTemplate[]
  emailTemplates: EmailTemplate[]
}) {
  const selectedWaTemplate = waTemplates.find(t => t.id === waTemplateId)

  return (
    <>
      <div className="space-y-1.5">
        <Label>Canais</Label>
        <p className="text-xs text-muted-foreground">Selecione um ou mais — cada canal envia com seu próprio template.</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => toggleChannel('whatsapp')}
            className={`flex-1 flex items-center justify-center gap-2 border rounded-none py-2.5 text-sm font-medium transition-colors ${channels.includes('whatsapp') ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            <MessageSquare className="w-4 h-4" /> WhatsApp
          </button>
          <button
            type="button"
            onClick={() => toggleChannel('email')}
            className={`flex-1 flex items-center justify-center gap-2 border rounded-none py-2.5 text-sm font-medium transition-colors ${channels.includes('email') ? 'border-primary bg-primary/5 text-primary' : 'text-muted-foreground hover:bg-muted/30'}`}
          >
            <Mail className="w-4 h-4" /> E-mail
          </button>
          <button
            type="button"
            disabled
            title="Envio de SMS em campanhas ainda não está disponível"
            className="flex-1 flex items-center justify-center gap-2 border rounded-none py-2.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
          >
            <Smartphone className="w-4 h-4" /> SMS <span className="text-[10px]">(em breve)</span>
          </button>
        </div>
      </div>

      {channels.includes('whatsapp') && (
        <div className="space-y-1.5">
          <Label>Template de WhatsApp</Label>
          {waTemplates.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-3">
              Nenhum template criado ainda. Crie um em Templates de WhatsApp primeiro.
            </p>
          ) : (
            <>
              <Select value={waTemplateId} onValueChange={setWaTemplateId}>
                <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
                <SelectContent>
                  {waTemplates.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.display_name || t.name} · {WA_STATUS_LABEL[t.status] || t.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedWaTemplate && selectedWaTemplate.status !== 'approved' && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-2">
                  Esse template está marcado como &quot;{WA_STATUS_LABEL[selectedWaTemplate.status] || selectedWaTemplate.status}&quot;, não &quot;Aprovado&quot;. Confirme na Meta que ele está realmente aprovado antes de disparar — fora da janela de 24h, só templates aprovados são entregues.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {channels.includes('email') && (
        <div className="space-y-1.5">
          <Label>Template de e-mail</Label>
          {emailTemplates.length === 0 ? (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-none p-3">
              Nenhum template de e-mail criado ainda. Crie um em Templates de E-mail primeiro.
            </p>
          ) : (
            <Select value={emailTemplateId} onValueChange={setEmailTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecione um template" /></SelectTrigger>
              <SelectContent>
                {emailTemplates.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}
    </>
  )
}
