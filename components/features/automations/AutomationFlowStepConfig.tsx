'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Step, StageOpt, WaTemplate } from './AutomationFlowMeta'
import type { AutomationFlowEdge } from '@/lib/automations/automation-traversal'
import { InstagramDmFields, BranchFields } from './AutomationFlowInstagramFields'
import { WhatsappTemplateFields } from './AutomationFlowWhatsappFields'
import { ConditionRulesFields } from './AutomationFlowConditionFields'

export function StepConfig({
  step, index, steps, setSteps, stages, whatsappTemplates, agentDefinitions, flowEdges, setStepEdges,
}: {
  step: Step
  index: number
  steps: Step[]
  setSteps: (s: Step[]) => void
  stages: StageOpt[]
  whatsappTemplates?: WaTemplate[]
  agentDefinitions?: { id: string; name: string }[]
  /** Edges saindo de QUALQUER step (não só este) — usado pra listar as
   *  ramificações já configuradas neste `wait_for_reply`. */
  flowEdges?: AutomationFlowEdge[]
  /** Substitui todas as edges saindo deste step por uma lista nova. */
  setStepEdges?: (stepId: string, edges: AutomationFlowEdge[]) => void
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
    case 'start_voice_ai':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Agente de Voice AI</Label>
            <Input placeholder="ID do agente (Voice → Agentes de IA)" value={step.config.agentId || ''}
              onChange={e => patch({ agentId: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label className={labelClass}>Contexto da ligação</Label>
            <textarea
              placeholder="Ex.: O lead {{contact.first_name}} veio da campanha {{lead.campaign}} interessado em {{lead.interest}}. Objetivo: confirmar interesse e agendar avaliação."
              value={step.config.context || ''}
              onChange={e => patch({ context: e.target.value })}
              rows={3}
              className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
            />
            <p className="text-xs text-muted-foreground">Aceita variáveis como {'{{contact.first_name}}'}, {'{{lead.source}}'}, {'{{lead.campaign}}'}.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className={labelClass}>Duração máx. (min)</Label>
              <Input type="number" min={1} value={step.config.maxDurationMinutes ?? 5}
                onChange={e => patch({ maxDurationMinutes: parseInt(e.target.value) || 5 })} />
            </div>
            <div className="space-y-2">
              <Label className={labelClass}>Tentativas se não atender</Label>
              <Input type="number" min={0} max={5} value={step.config.maxAttempts ?? 1}
                onChange={e => patch({ maxAttempts: parseInt(e.target.value) || 1 })} />
            </div>
          </div>
        </div>
      )
    case 'send_sms':
      return (
        <div className="space-y-2">
          <Label className={labelClass}>Mensagem</Label>
          <textarea
            placeholder="Ex.: Olá {{contact.first_name}}, sua consulta está confirmada para {{appointment.date}} às {{appointment.time}}."
            value={step.config.message || ''}
            onChange={e => patch({ message: e.target.value })}
            rows={3}
            className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
          />
          <p className="text-xs text-muted-foreground">Aceita as mesmas variáveis do WhatsApp.</p>
        </div>
      )
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
    case 'condition':
      return <ConditionRulesFields step={step} patch={patch} />
    case 'assign_agent':
      return (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className={labelClass}>Agente IA</Label>
            <Select
              value={step.config.agentDefinitionId || '__none__'}
              onValueChange={v => patch({ agentDefinitionId: v === '__none__' ? '' : v })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Desatribuir (volta ao padrão)</SelectItem>
                {(agentDefinitions || []).map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            {(agentDefinitions || []).length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nenhum Agente IA cadastrado — crie um em Configurações → Agente IA.
              </p>
            )}
          </div>
          {step.config.agentDefinitionId && (
            <div className="space-y-2">
              <Label className={labelClass}>Objetivo desta execução</Label>
              <textarea
                placeholder="Ex: Cobrar {{lead.name}} sobre a fatura em aberto e registrar se houve promessa de pagamento."
                value={step.config.objective || ''}
                onChange={e => patch({ objective: e.target.value })}
                rows={3}
                className="w-full rounded-md border border-input bg-input/25 p-2.5 text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Some ao objetivo/personalidade já configurados na Agent Definition — não os substitui. Atribui a conversa de
                WhatsApp do lead a este agente a partir de agora (a próxima mensagem inbound já é atendida por ele).
              </p>
            </div>
          )}
        </div>
      )
    case 'send_instagram_dm':
      return <InstagramDmFields step={step} patch={patch} labelClass={labelClass} />
    case 'wait_for_reply':
      return (
        <BranchFields
          step={step}
          steps={steps}
          index={index}
          edges={(flowEdges || []).filter(e => e.from === step.id)}
          setEdges={next => setStepEdges?.(step.id, next)}
          labelClass={labelClass}
        />
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

