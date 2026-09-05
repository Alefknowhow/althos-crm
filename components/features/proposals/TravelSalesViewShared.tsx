'use client'

// Shared types, constants, and small self-contained components used by
// TravelSalesView.tsx and its extracted siblings (NewSaleDialog, SaleEditor).
// Pure code motion — no behavior change.

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from '@/components/ui/command'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { CheckCircle2, Check, ChevronsUpDown, UserCircle2 } from 'lucide-react'

export type ProposalOption = { id: string; title: string | null; client_name: string | null; contato_id?: string | null }
export type LeadOption = { id: string; name: string; phone: string | null }
export type Member = { user_id: string; name: string; email: string }
export type Voucher = { url: string; name: string }

export const SERVICE_LABELS: Record<string, string> = {
  transfer: 'Traslado', insurance: 'Seguro viagem', car_rental: 'Locação de carro',
}

export const PAYMENT_METHODS = ['Pix', 'Cartão de crédito', 'Boleto'] as const

// Keyboard focus ring for the custom <button> filters/toggles (the design
// system zeroes the native outline).
export const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background'

export const INCLUDED_ITEMS: { key: string; label: string }[] = [
  { key: 'voos', label: 'Voos' },
  { key: 'hospedagem', label: 'Hospedagem' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'cruzeiros', label: 'Cruzeiros' },
  { key: 'seguro', label: 'Seguro viagem' },
  { key: 'passeios', label: 'Passeios' },
  { key: 'carros', label: 'Locação de carro' },
  { key: 'ingressos', label: 'Ingressos' },
  { key: 'servicos', label: 'Serviços' },
]

export function centsToReais(c?: number | null) { return c ? String((c / 100).toFixed(2)).replace('.', ',') : '' }
export function reaisToCents(s: string) {
  const n = parseFloat((s || '').replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export function MoneyInput({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  const [text, setText] = useState(centsToReais(value))
  return (
    <Input inputMode="decimal" placeholder="R$ 0,00" value={text}
      onChange={e => { setText(e.target.value); onChange(reaisToCents(e.target.value)) }} />
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>
}

/**
 * "Reter comissão": quando o cliente dá entrada à vista, a agência às vezes
 * já fica com parte (ou toda) a comissão nesse momento, em vez de esperar o
 * repasse da operadora. Esse controle só marca QUANTO disso foi retido —
 * a Comissão continua sendo o valor cheio; o Financeiro é quem usa os dois
 * números pra separar em dois lançamentos (retido na data da venda, o resto
 * na data de pagamento da operadora).
 */
export function RetainedCommissionField({
  commissionCents, retainedCents, onChange,
}: {
  commissionCents: number
  retainedCents: number | null
  onChange: (v: number | null) => void
}) {
  const [open, setOpen] = useState(false)
  const active = retainedCents != null && retainedCents > 0
  const clamp = (v: number) => Math.max(0, Math.min(v, commissionCents))

  return (
    <Field label="Comissão retida na venda">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={!commissionCents}
            className={cn(
              'w-full h-9 px-3 rounded-md border text-sm text-left transition-colors flex items-center justify-between',
              FOCUS_RING,
              !commissionCents
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : active
                  ? 'bg-success/10 border-success/30 text-success'
                  : 'bg-background hover:bg-muted text-muted-foreground',
            )}
          >
            <span>{active ? `${centsToReais(retainedCents!)} retido agora` : 'Nenhuma retenção'}</span>
            {active && <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 space-y-2" align="start">
          <p className="text-xs text-muted-foreground">
            Quanto da comissão ({centsToReais(commissionCents)}) já ficou com a agência na
            entrada à vista? Lançado no Financeiro na data da venda; o restante entra na data
            de pagamento da operadora.
          </p>
          <MoneyInput
            value={retainedCents || 0}
            onChange={v => onChange(clamp(v) || null)}
          />
          {retainedCents != null && retainedCents >= commissionCents && commissionCents > 0 && (
            <p className="text-[11px] text-muted-foreground">Comissão 100% retida — nada a receber da operadora.</p>
          )}
          {active && (
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs w-full" onClick={() => { onChange(null); setOpen(false) }}>
              Remover retenção
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </Field>
  )
}

// Combobox com busca por digitação — a lista de contatos pode ser grande,
// então rolar com o mouse num <select> comum não escala.
export function ContactCombobox({ leads, value, onChange }: {
  leads: LeadOption[]
  value: string
  onChange: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = leads.find(l => l.id === value) || null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? `${selected.name}${selected.phone ? ` · ${selected.phone}` : ''}` : 'Selecione o contato do CRM'}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command
          filter={(id, search) => {
            const lead = leads.find(l => l.id === id)
            if (!lead) return 0
            const haystack = `${lead.name} ${lead.phone || ''}`.toLowerCase()
            return haystack.includes(search.toLowerCase()) ? 1 : 0
          }}
        >
          <CommandInput placeholder="Buscar por nome ou telefone..." />
          <CommandList>
            <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            <CommandGroup>
              {leads.map(l => (
                <CommandItem
                  key={l.id}
                  value={l.id}
                  onSelect={() => { onChange(l.id); setOpen(false) }}
                >
                  <Check className={cn('mr-2 h-4 w-4 shrink-0', value === l.id ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{l.name}{l.phone ? ` · ${l.phone}` : ''}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

/** Operadora — Select com as operadoras cadastradas em Financeiro (Configurações
 *  > Operadoras); "Outra…" abre um campo de texto livre pra quem ainda não
 *  cadastrou lá, sem bloquear o preenchimento da venda. */
export function OperatorInput({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: string[] }) {
  const [freeText, setFreeText] = useState(!!value && !options.includes(value))

  if (freeText || options.length === 0) {
    return (
      <div className="flex gap-1.5">
        <Input value={value} onChange={e => onChange(e.target.value)} placeholder="Ex.: CVC, Azul Viagens…" />
        {options.length > 0 && (
          <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => setFreeText(false)}>Lista</Button>
        )}
      </div>
    )
  }

  return (
    <Select value={value || undefined} onValueChange={v => v === '__other__' ? setFreeText(true) : onChange(v)}>
      <SelectTrigger><SelectValue placeholder="Selecione a operadora" /></SelectTrigger>
      <SelectContent>
        {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        <SelectItem value="__other__">Outra (digitar)…</SelectItem>
      </SelectContent>
    </Select>
  )
}

/** Campo de nome do viajante com sugestões de Contatos conforme digita —
 *  clicar numa sugestão auto-preenche nascimento/CPF do cadastro (substitui
 *  o antigo botão separado "Puxar de contatos"). */
export function TravelerNameAutocomplete({
  leads, value, onChangeText, onPickLead,
}: {
  leads: LeadOption[]
  value: string
  onChangeText: (v: string) => void
  onPickLead: (leadId: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const q = value.trim().toLowerCase()
  const matches = q.length >= 2 ? leads.filter(l => l.name.toLowerCase().includes(q)).slice(0, 6) : []
  const showSuggestions = focused && matches.length > 0

  return (
    <div className="relative">
      <Input
        placeholder="Nome completo"
        value={value}
        onChange={e => onChangeText(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
      />
      {showSuggestions && (
        <div className="absolute z-20 mt-1 w-full rounded-md border bg-popover shadow-md overflow-hidden">
          {matches.map(l => (
            <button
              key={l.id}
              type="button"
              onMouseDown={e => e.preventDefault()}
              onClick={() => { onPickLead(l.id); setFocused(false) }}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-muted/60"
            >
              <UserCircle2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{l.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
