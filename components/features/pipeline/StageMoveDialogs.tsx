'use client'

/**
 * Popups disparados ao mover um lead pra determinadas etapas do funil —
 * compartilhados entre o Kanban (pipeline) e os pontos de troca de etapa
 * no WhatsApp/Instagram (LeadDataTab, lista de conversas), pra não duplicar
 * a mesma regra em cada lugar que move um lead de etapa.
 *
 * - is_lost  → LostMoveDialog: distingue Perdido de Desqualificado + motivo.
 * - is_won   → WonValueDialog: confirma/atualiza o valor da conversão.
 * - "negociação" (por nome da etapa — não há flag dedicada) → NegotiationValueDialog.
 */

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, parseCurrency } from '@/lib/utils'

/** Etapa "Negociação" não tem uma flag própria no banco (só is_won/is_lost
 *  existem) — identificamos pelo nome, igual outras convenções de texto já
 *  usadas no app (ex.: LOSS_REASON_OPTIONS). */
export function isNegotiationStage(stage: { name?: string | null } | null | undefined): boolean {
  return !!stage?.name && stage.name.toLowerCase().includes('negocia')
}

const OTHER_REASON = '__outro__'

/** Lista padronizada de motivos — mantém o relatório "Motivos de perda"
 *  (BarListCard em PipelineTab, agrupado por igualdade exata de texto)
 *  útil em vez de fragmentado em dezenas de variações de texto livre. */
export const LOSS_REASON_OPTIONS = [
  'Sem resposta / não retornou contato',
  'Achou caro / orçamento incompatível',
  'Fechou com concorrente',
  'Fora do perfil / não qualificado',
  'Desistiu da compra/viagem',
  'Adiou a decisão',
  'Não tinha interesse real',
]

/** Pede pra distinguir Perdido de Desqualificado (+ motivo) ao mover um card
 * pra uma etapa is_lost. Perdido = negociação real que não avançou;
 * Desqualificado = nunca foi um lead viável — são conversões diferentes
 * pro relatório, por isso não usam o mesmo rótulo por padrão. */
export function LostMoveDialog({
  open, onCancel, onConfirm,
}: {
  open: boolean
  onCancel: () => void
  onConfirm: (dealStatus: 'perdido' | 'desqualificado', reason: string) => void
}) {
  const [dealStatus, setDealStatus] = useState<'perdido' | 'desqualificado'>('perdido')
  const [reasonOption, setReasonOption] = useState('')
  const [customReason, setCustomReason] = useState('')

  useEffect(() => {
    if (open) { setDealStatus('perdido'); setReasonOption(''); setCustomReason('') }
  }, [open])

  const finalReason = reasonOption === OTHER_REASON ? customReason.trim() : reasonOption

  return (
    <Dialog open={open} onOpenChange={op => { if (!op) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Encerrar negociação</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <RadioGroup value={dealStatus} onValueChange={v => setDealStatus(v as 'perdido' | 'desqualificado')}>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="perdido" id="lost-perdido" />
              <Label htmlFor="lost-perdido">Perdido — negociação real que não avançou</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="desqualificado" id="lost-desqualificado" />
              <Label htmlFor="lost-desqualificado">Desqualificado — nunca foi um lead viável</Label>
            </div>
          </RadioGroup>
          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reasonOption} onValueChange={setReasonOption}>
              <SelectTrigger><SelectValue placeholder="Selecione um motivo" /></SelectTrigger>
              <SelectContent>
                {LOSS_REASON_OPTIONS.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
                <SelectItem value={OTHER_REASON}>Outro (descrever)</SelectItem>
              </SelectContent>
            </Select>
            {reasonOption === OTHER_REASON && (
              <Textarea
                value={customReason}
                onChange={e => setCustomReason(e.target.value)}
                placeholder="Descreva o motivo…"
                rows={3}
                autoFocus
              />
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(dealStatus, finalReason || 'Motivo não informado')}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pede o valor final da conversão ao mover um lead pra uma etapa is_won —
 *  pré-preenchido com o valor já cadastrado no lead, editável antes de
 *  confirmar (o valor pode ter mudado durante a negociação). */
export function WonValueDialog({
  open, defaultCents, onCancel, onConfirm,
}: {
  open: boolean
  defaultCents?: number | null
  onCancel: () => void
  onConfirm: (valueCents: number) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue(defaultCents ? formatCurrency(defaultCents) : '')
  }, [open, defaultCents])

  return (
    <Dialog open={open} onOpenChange={op => { if (!op) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Negócio ganho 🎉</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Valor da conversão</Label>
          <Input
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={e => setValue(formatCurrency(parseCurrency(e.target.value)))}
            placeholder="R$ 0,00"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(parseCurrency(value))}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pede o valor em negociação ao mover um lead pra uma etapa "Negociação" —
 *  mesmo padrão do WonValueDialog, mas antes do fechamento. */
export function NegotiationValueDialog({
  open, defaultCents, onCancel, onConfirm,
}: {
  open: boolean
  defaultCents?: number | null
  onCancel: () => void
  onConfirm: (valueCents: number) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (open) setValue(defaultCents ? formatCurrency(defaultCents) : '')
  }, [open, defaultCents])

  return (
    <Dialog open={open} onOpenChange={op => { if (!op) onCancel() }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Valor da negociação</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Quanto está sendo negociado?</Label>
          <Input
            inputMode="numeric"
            autoFocus
            value={value}
            onChange={e => setValue(formatCurrency(parseCurrency(e.target.value)))}
            placeholder="R$ 0,00"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancelar</Button>
          <Button onClick={() => onConfirm(parseCurrency(value))}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
