'use client'

import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ImageUploadButton from '../ImageUploadButton'

interface Props {
  orgSlug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  schema: any
  setSchema: (s: any) => void
  form: any
  setForm: (f: any) => void
  pipelines: any[]
  stages: any[]
}

/** Configurações do formulário como um todo (não de uma página específica):
 *  modo de exibição, briefing, WhatsApp alternativo, logo/assinatura,
 *  rodapé institucional, destino do lead, nota de Meta Pixel. */
export default function SettingsSheet({ orgSlug, open, onOpenChange, schema, setSchema, form, setForm, pipelines, stages }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações do formulário</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <h3 className="font-semibold text-sm">Modo de Exibição</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSchema({ ...schema, mode: 'classic' })}
                className={`p-3 border rounded-md text-left transition-colors ${(schema.mode || 'classic') === 'classic' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
              >
                <div className="font-medium text-sm">Clássico</div>
                <div className="text-xs text-muted-foreground mt-0.5">Todos os campos numa página</div>
              </button>
              <button
                type="button"
                onClick={() => setSchema({ ...schema, mode: 'one_question' })}
                className={`p-3 border rounded-md text-left transition-colors ${schema.mode === 'one_question' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}
              >
                <div className="font-medium text-sm">Uma pergunta por vez</div>
                <div className="text-xs text-muted-foreground mt-0.5">Estilo Typeform, com progresso</div>
              </button>
            </div>
          </div>

          {(schema.mode || 'classic') === 'classic' && (
            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Briefing</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Texto curto acima das perguntas, na página do formulário.</p>
                </div>
                <input
                  type="checkbox"
                  checked={!!schema.briefing?.enabled}
                  onChange={e => setSchema({ ...schema, briefing: { ...(schema.briefing || {}), enabled: e.target.checked } })}
                  className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
                />
              </div>
              {schema.briefing?.enabled && (
                <textarea
                  className="flex min-h-[70px] w-full rounded-md border border-input bg-input/25 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={schema.briefing?.text || ''}
                  onChange={e => setSchema({ ...schema, briefing: { ...schema.briefing, text: e.target.value } })}
                  placeholder="Ex: Preencha os dados abaixo pra montarmos sua proposta personalizada."
                />
              )}
            </div>
          )}

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Botão WhatsApp (alternativa)</h3>
              <input
                type="checkbox"
                checked={!!schema.whatsapp?.enabled}
                onChange={e => setSchema({ ...schema, whatsapp: { ...(schema.whatsapp || {}), enabled: e.target.checked } })}
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
            </div>
            {schema.whatsapp?.enabled && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Número (com DDI, só dígitos)</Label>
                  <Input value={schema.whatsapp?.phone || ''} onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, phone: e.target.value } })} placeholder="5547999999999" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mensagem pré-preenchida</Label>
                  <Input value={schema.whatsapp?.message || ''} onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, message: e.target.value } })} placeholder="Olá! Vim do formulário..." />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Texto do botão</Label>
                  <Input value={schema.whatsapp?.label || ''} onChange={e => setSchema({ ...schema, whatsapp: { ...schema.whatsapp, label: e.target.value } })} placeholder="Falar no WhatsApp" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Logo e Assinatura</h3>
                <p className="text-[11px] text-muted-foreground">Exibida no topo ou rodapé de cada página.</p>
              </div>
              <input
                type="checkbox"
                checked={!!schema.signature?.enabled}
                onChange={e => setSchema({ ...schema, signature: { ...(schema.signature || {}), enabled: e.target.checked } })}
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
            </div>
            {schema.signature?.enabled && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setSchema({ ...schema, signature: { ...schema.signature, position: 'top' } })} className={`p-2 border rounded-md text-xs transition-colors ${(schema.signature?.position || 'footer') === 'top' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>Topo</button>
                  <button type="button" onClick={() => setSchema({ ...schema, signature: { ...schema.signature, position: 'footer' } })} className={`p-2 border rounded-md text-xs transition-colors ${(schema.signature?.position || 'footer') === 'footer' ? 'border-primary bg-primary/5' : 'hover:border-primary/50'}`}>Rodapé</button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Logo</Label>
                  <ImageUploadButton orgSlug={orgSlug} value={schema.signature?.logoUrl} onChange={url => setSchema({ ...schema, signature: { ...schema.signature, logoUrl: url } })} previewHeight="max-h-20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome / Slogan</Label>
                  <Input value={schema.signature?.name || ''} onChange={e => setSchema({ ...schema, signature: { ...schema.signature, name: e.target.value } })} placeholder="Ex: Althos Performance" />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-sm">Dados da empresa no rodapé</h3>
                <p className="text-[11px] text-muted-foreground">CNPJ, endereço etc — no final de cada página.</p>
              </div>
              <input
                type="checkbox"
                checked={!!schema.footerInfo?.enabled}
                onChange={e => setSchema({ ...schema, footerInfo: { ...(schema.footerInfo || {}), enabled: e.target.checked } })}
                className="w-4 h-4 rounded border-gray-300 accent-primary cursor-pointer"
              />
            </div>
            {schema.footerInfo?.enabled && (
              <textarea
                className="flex min-h-[60px] w-full rounded-md border border-input bg-input/25 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={schema.footerInfo?.text || ''}
                onChange={e => setSchema({ ...schema, footerInfo: { ...schema.footerInfo, text: e.target.value } })}
                placeholder="Ex: Althos Viagens LTDA · CNPJ 00.000.000/0001-00"
              />
            )}
          </div>

          <div className="space-y-3 pt-4 border-t">
            <h3 className="font-semibold text-sm">Destino do Lead</h3>
            <div className="grid grid-cols-1 gap-2">
              <Select
                value={form.pipeline_id || '__none__'}
                onValueChange={v => setForm({ ...form, pipeline_id: v === '__none__' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o Pipeline" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione o Pipeline</SelectItem>
                  {pipelines.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select
                value={form.stage_id || '__none__'}
                onValueChange={v => setForm({ ...form, stage_id: v === '__none__' ? '' : v })}
              >
                <SelectTrigger><SelectValue placeholder="Selecione o Estágio" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Selecione o Estágio</SelectItem>
                  {stages.filter((s: any) => s.pipeline_id === form.pipeline_id).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-[11px] text-muted-foreground">
              <strong>Meta Pixel / CAPI:</strong> configure o Pixel ID e o Access Token em{' '}
              <strong>Configurações → Meta</strong> da organização. Quando configurados, o evento{' '}
              <em>Lead</em> é enviado automaticamente ao submeter o formulário.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
