'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Step, StageOpt, WaTemplate } from './AutomationFlowMeta'

export function StepConfig({
  step, index, steps, setSteps, stages, whatsappTemplates,
}: {
  step: Step
  index: number
  steps: Step[]
  setSteps: (s: Step[]) => void
  stages: StageOpt[]
  whatsappTemplates?: WaTemplate[]
}) {
  function patch(u: Record<string, any>) {
    const next = [...steps]
    next[index] = { ...next[index], config: { ...next[index].config, ...u } }
    setSteps(next)
  }

  const labelClass = 'text-xs font-semibold uppercase tracking-wider text-muted-foreground'

  switch (step.type) {
    case 'wait':
      return (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className={labelClass}>Quantidade</Label>
            <Input type="number" min={1} value={step.config.amount ?? 1}
              onChange={e => patch({ amount: parseInt(e.target.value) || 1 })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Unidade</Label>
            <Select value={step.config.unit || 'minutes'} onValueChange={v => patch({ unit: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
                <SelectItem value="days">Dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    case 'send_email':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Template ID</Label>
          <Input placeholder="ID do template de e-mail" value={step.config.templateId || ''}
            onChange={e => patch({ templateId: e.target.value })} />
          <p className="text-xs text-muted-foreground">Cole o ID do template criado em Templates.</p>
        </div>
      )
    case 'send_whatsapp':
      return <WhatsappTemplateFields step={step} patch={patch} whatsappTemplates={whatsappTemplates} labelClass={labelClass} />
    case 'create_task':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Título da tarefa</Label>
            <Input placeholder="Ex: Ligar para o lead" value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={labelClass}>Prazo (dias)</Label>
              <Input type="number" min={1} value={step.config.dueInDays ?? 1}
                onChange={e => patch({ dueInDays: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Prioridade</Label>
              <Select value={step.config.priority || 'normal'} onValueChange={v => patch({ priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )
    case 'move_stage':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Mover para</Label>
          <Select value={step.config.stageId || '__none__'} onValueChange={v => patch({ stageId: v === '__none__' ? '' : v })}>
            <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Selecione...</SelectItem>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )
    case 'close_deal':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Resultado</Label>
            <Select value={step.config.dealStatus || 'perdido'} onValueChange={v => patch({ dealStatus: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="perdido">Perdido</SelectItem>
                <SelectItem value="desqualificado">Desqualificado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Motivo</Label>
            <Input placeholder="Ex: Sem resposta" value={step.config.reason || ''}
              onChange={e => patch({ reason: e.target.value })} />
          </div>
        </div>
      )
    case 'add_tag':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Nome da tag</Label>
          <Input placeholder="Ex: VIP" value={step.config.tag || ''}
            onChange={e => patch({ tag: e.target.value })} />
        </div>
      )
    case 'send_push':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Título</Label>
            <Input placeholder="Ex: Novo lead no funil" value={step.config.title || ''}
              onChange={e => patch({ title: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Mensagem</Label>
            <Input placeholder="{{lead.name}} entrou no estágio {{stage}}" value={step.config.body || ''}
              onChange={e => patch({ body: e.target.value })} />
            <p className="text-xs text-muted-foreground">
              Variáveis: <code className="bg-muted px-1 rounded">{'{{lead.name}}'}</code>{' '}
              <code className="bg-muted px-1 rounded">{'{{lead.email}}'}</code>
            </p>
          </div>
        </div>
      )
    case 'webhook':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>URL</Label>
            <Input type="url" placeholder="https://hooks.exemplo.com/notify" value={step.config.url || ''}
              onChange={e => patch({ url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Método</Label>
            <Select value={step.config.method || 'POST'} onValueChange={v => patch({ method: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Headers extras (JSON)</Label>
            <Input placeholder={'{"Authorization": "Bearer token"}'} value={step.config.headers || ''}
              onChange={e => patch({ headers: e.target.value })} />
          </div>
        </div>
      )
    case 'send_nps_survey':
      return (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Manda um template aprovado pelo WhatsApp do lead pedindo a nota de 0 a 10. Combine com um passo{' '}
            <b>Aguardar</b> antes pra esperar alguns dias após a venda/retorno da viagem. A nota em si é sempre
            registrada manualmente em Contatos, ao ler a resposta.
          </p>
          <WhatsappTemplateFields step={step} patch={patch} whatsappTemplates={whatsappTemplates} labelClass={labelClass} />
        </div>
      )
    default:
      return null
  }
}

/** Template HSM aprovado + variáveis — compartilhado entre os passos
 *  "Enviar WhatsApp" e "Pesquisa NPS" (a Meta exige template aprovado pra
 *  mandar mensagem fora da janela de 24h, então os dois precisam do mesmo
 *  seletor, não faz sentido ter um caminho de texto livre separado). */
function WhatsappTemplateFields({
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
