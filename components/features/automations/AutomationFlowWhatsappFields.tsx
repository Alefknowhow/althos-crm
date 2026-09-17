'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Step, WaTemplate } from './AutomationFlowMeta'

/** Template HSM aprovado + variáveis — compartilhado entre os passos
 *  "Enviar WhatsApp" e "Pesquisa NPS" (a Meta exige template aprovado pra
 *  mandar mensagem fora da janela de 24h, então os dois precisam do mesmo
 *  seletor, não faz sentido ter um caminho de texto livre separado).
 *  Extraído de AutomationFlowStepConfig.tsx só por tamanho de arquivo
 *  (limite de 350 linhas do projeto), sem mudança de comportamento. */
export function WhatsappTemplateFields({
  step, patch, whatsappTemplates, labelClass,
}: {
  step: Step
  patch: (u: Record<string, any>) => void
  whatsappTemplates?: WaTemplate[]
  labelClass: string
}) {
  const templates = whatsappTemplates ?? []
  const selectedTpl = templates.find(t => t.name === step.config.templateName) ?? null
  const varNames: string[] = selectedTpl?.variable_names ?? []

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className={labelClass}>Template aprovado</Label>
        {templates.length > 0 ? (
          <select
            className="flex h-9 w-full rounded-md border border-input bg-input/25 px-3 text-sm"
            value={step.config.templateName || ''}
            onChange={e => {
              const tpl = templates.find(t => t.name === e.target.value) ?? null
              patch({
                templateName:   e.target.value,
                templateId:     tpl?.id ?? '',
                language:       tpl?.language ?? 'pt_BR',
                headerType:     tpl?.header_type ?? 'none',
                headerMediaUrl: tpl?.header_media_url ?? '',
                variables:      tpl?.variable_names ? tpl.variable_names.map(() => '') : [],
              })
            }}
          >
            <option value="">Selecione um template…</option>
            {templates.map(t => (
              <option key={t.id} value={t.name}>{t.display_name} ({t.name})</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-muted-foreground">
            Nenhum template aprovado ainda. Crie e aguarde a aprovação da Meta em{' '}
            <strong>Operações › Templates WA</strong> pra poder selecionar aqui.
          </p>
        )}
      </div>

      {/* Preview do template selecionado */}
      {selectedTpl && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-xs space-y-1">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300 leading-tight">{selectedTpl.display_name}</p>
          <p className="text-emerald-700 dark:text-emerald-300 leading-relaxed line-clamp-3">{selectedTpl.body_text}</p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {selectedTpl.header_type !== 'none' && (
              <span className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium uppercase">
                Header: {selectedTpl.header_type}
              </span>
            )}
            <span className="inline-block bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 px-1.5 py-0.5 rounded-full text-[10px] font-medium">
              {selectedTpl.language}
            </span>
          </div>
        </div>
      )}

      {/* Variable value inputs */}
      {varNames.map((varName, idx) => (
        <div key={idx} className="space-y-1.5">
          <Label className={labelClass}>
            {`{{${idx + 1}}}`} — {varName}
          </Label>
          <Input
            placeholder={`Valor para ${varName} (ex.: {{lead.name}})`}
            value={(step.config.variables ?? [])[idx] ?? ''}
            onChange={e => {
              const vars = [...(step.config.variables ?? Array(varNames.length).fill(''))] as string[]
              vars[idx] = e.target.value
              patch({ variables: vars })
            }}
          />
        </div>
      ))}

      {step.config.templateName && (
        <p className="text-[10px] text-muted-foreground">
          Nome Meta: <code className="bg-muted px-1 rounded">{step.config.templateName}</code>
          {' · '}Idioma: <strong>{step.config.language || 'pt_BR'}</strong>
        </p>
      )}
    </div>
  )
}
