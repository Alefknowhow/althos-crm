'use client'

/**
 * The recurrence-fields sub-form and the new-entry dialog for
 * FinancialEntriesView. Split out of FinancialEntriesView.tsx.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCurrency } from '@/lib/utils'
import { createFinancialEntry, uploadFinancialAttachment } from '@/actions/financial'
import type { FinancialSettingType, FinancialSettingRow } from '@/actions/financial-settings'
import FinancialDocumentPanel from './FinancialDocumentPanel'
import LeadCombobox from '@/components/features/LeadCombobox'
import {
  FREQUENCY_LABELS, computeRecurrenceDates, computeInstallmentDates, type RecurrenceFrequency,
} from '@/lib/financial/recurrence'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import { toast } from 'sonner'
import {
  Plus, TrendingUp, TrendingDown, Repeat, CreditCard, AlertTriangle, Sparkles,
} from 'lucide-react'
import {
  fmtDate, MoneyInput, Field, SettingSelect, withExtra, TipoToggle,
} from './FinancialEntriesShared'

const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS) as [RecurrenceFrequency, string][]

export function RecurrenceFields({
  frequency, setFrequency, count, setCount, until, setUntil, infinite, setInfinite,
}: {
  frequency: RecurrenceFrequency
  setFrequency: (f: RecurrenceFrequency) => void
  count: number
  setCount: (n: number) => void
  until: string
  setUntil: (v: string) => void
  infinite: boolean
  setInfinite: (b: boolean) => void
}) {
  return (
    <div className="space-y-2.5 rounded-lg border bg-muted/20 p-3">
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Frequência">
          <Select value={frequency} onValueChange={v => setFrequency(v as RecurrenceFrequency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label={infinite ? 'Repetições (ignorado — infinita)' : 'Quantidade de repetições'}>
          <Input type="number" min={1} max={60} disabled={infinite} value={count} onChange={e => setCount(Math.max(1, Number(e.target.value) || 1))} />
        </Field>
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <Field label="Ou repetir até a data (opcional)">
          <Input type="date" value={until} onChange={e => setUntil(e.target.value)} disabled={infinite} />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
          <Checkbox checked={infinite} onCheckedChange={v => setInfinite(v === true)} />
          Recorrência infinita
        </label>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Gera até 60 ocorrências de uma vez (trava de segurança) — se marcar &quot;infinita&quot;, uma nova leva precisa ser gerada mais adiante.
      </p>
    </div>
  )
}

export function NewEntryDialog({
  orgSlug, settings, open, onOpenChange, creating, setCreating, onCreated,
}: {
  orgSlug: string
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  open: boolean
  onOpenChange: (o: boolean) => void
  creating: boolean
  setCreating: (b: boolean) => void
  onCreated: (id: string) => void
}) {
  const router = useRouter()
  const [tipo, setTipo] = useState<'receita' | 'despesa'>('despesa')
  const [categoria, setCategoria] = useState<string | null>(null)
  const [subcategoria, setSubcategoria] = useState<string | null>(null)
  const [centroCusto, setCentroCusto] = useState<string | null>(null)
  const [contaBancaria, setContaBancaria] = useState<string | null>(null)
  const [formaPagamento, setFormaPagamento] = useState<string | null>(null)
  const [contatoId, setContatoId] = useState<string | null>(null)
  const [valorCents, setValorCents] = useState(0)
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 10))
  const [vencimento, setVencimento] = useState('')
  const [observacoes, setObservacoes] = useState('')

  const [isRecurring, setIsRecurring] = useState(false)
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('mensal')
  const [recCount, setRecCount] = useState(11)
  const [recUntil, setRecUntil] = useState('')
  const [recInfinite, setRecInfinite] = useState(false)

  const [isInstallment, setIsInstallment] = useState(false)
  const [installmentTotal, setInstallmentTotal] = useState(2)
  const [installmentInterval, setInstallmentInterval] = useState(30)

  const [showMore, setShowMore] = useState(false)
  const [notaFiscal, setNotaFiscal] = useState('')
  const [numeroDocumento, setNumeroDocumento] = useState('')
  const [projeto, setProjeto] = useState('')
  const [unidadeNegocio, setUnidadeNegocio] = useState('')

  const [pendingFile, setPendingFile] = useState<File | null>(null)

  const [step, setStep] = useState(0)

  function reset() {
    setTipo('despesa'); setCategoria(null); setSubcategoria(null); setCentroCusto(null)
    setContaBancaria(null); setFormaPagamento(null); setContatoId(null); setValorCents(0)
    setCompetencia(new Date().toISOString().slice(0, 10)); setVencimento(''); setObservacoes('')
    setIsRecurring(false); setFrequency('mensal'); setRecCount(11); setRecUntil(''); setRecInfinite(false)
    setIsInstallment(false); setInstallmentTotal(2); setInstallmentInterval(30)
    setShowMore(false); setNotaFiscal(''); setNumeroDocumento(''); setProjeto(''); setUnidadeNegocio('')
    setPendingFile(null)
    setStep(0)
  }

  function applyExtracted(data: ExtractedFinancialDocument) {
    if (data.tipo) setTipo(data.tipo)
    if (data.descricao) setObservacoes(data.descricao)
    if (data.categoria_sugerida) setCategoria(data.categoria_sugerida)
    if (data.valor_cents) setValorCents(data.valor_cents)
    if (data.data_emissao) setCompetencia(data.data_emissao)
    if (data.vencimento) setVencimento(data.vencimento)
    if (data.numero_documento) setNumeroDocumento(data.numero_documento)
    if (data.emissor && !observacoes) setObservacoes(prev => prev || `${data.descricao ? data.descricao + ' — ' : ''}${data.emissor}`)
  }

  const previewDates = useMemo(() => {
    const base = vencimento || competencia
    if (isInstallment && installmentTotal > 1) return computeInstallmentDates(base, installmentTotal, installmentInterval)
    if (isRecurring) return computeRecurrenceDates(base, { frequency, count: recCount, until: recUntil || null, infinite: recInfinite })
    return []
  }, [isRecurring, isInstallment, frequency, recCount, recUntil, recInfinite, installmentTotal, installmentInterval, vencimento, competencia])

  const WIZARD_STEPS = ['Anexo', 'Tipo', 'Informações básicas', 'Datas', 'Pagamento', 'Recorrência', 'Parcelamento', 'Resumo']

  function goNext() {
    if (step === 2 && (!categoria?.trim() || !valorCents)) {
      toast.error('Informe categoria e valor para continuar.')
      return
    }
    setStep(s => Math.min(s + 1, WIZARD_STEPS.length - 1))
  }
  function goBack() {
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleCreate(keepOpen = false) {
    if (!categoria?.trim()) { toast.error('Informe a categoria.'); return }
    if (!valorCents) { toast.error('Informe o valor.'); return }
    if (isRecurring && isInstallment) { toast.error('Escolha recorrência OU parcelamento, não os dois.'); return }
    if (previewDates.length > 20 && !confirm(`Isso vai gerar ${previewDates.length + 1} lançamentos. Confirmar?`)) return
    setCreating(true)
    const res = await createFinancialEntry(orgSlug, {
      tipo, categoria: categoria.trim(), subcategoria, centro_custo: centroCusto,
      conta_bancaria: contaBancaria, forma_pagamento: formaPagamento, contato_id: contatoId,
      valor_cents: valorCents, competencia, vencimento: vencimento || null,
      observacoes: observacoes.trim() || null,
      is_recurring: isRecurring,
      recurrence_frequency: isRecurring ? frequency : null,
      recurrence_count: isRecurring && !recInfinite ? recCount : null,
      recurrence_until: isRecurring && recUntil ? recUntil : null,
      recurrence_infinite: isRecurring ? recInfinite : false,
      parcela_total: isInstallment ? installmentTotal : null,
      installment_interval_days: isInstallment ? installmentInterval : null,
      nota_fiscal: notaFiscal.trim() || null,
      numero_documento: numeroDocumento.trim() || null,
      projeto: projeto.trim() || null,
      unidade_negocio: unidadeNegocio.trim() || null,
    })
    if (!res.ok) { setCreating(false); toast.error(res.error); return }

    // Anexo escolhido antes de criar o lançamento (fluxo do "Ler com IA")
    // só sobe pro storage agora, que já existe um entryId pra vincular.
    if (pendingFile) {
      const fd = new FormData()
      fd.append('file', pendingFile)
      const upRes = await uploadFinancialAttachment(orgSlug, res.data.id, fd)
      if (!upRes.ok) toast.error(`Lançamento criado, mas o anexo falhou: ${upRes.error}`)
    }

    setCreating(false)
    toast.success('Lançamento criado')
    if (keepOpen) {
      const keepType = tipo
      reset()
      setTipo(keepType)
      router.refresh()
    } else {
      reset()
      onCreated(res.data.id)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Novo lançamento</DialogTitle>
          <DialogDescription>Registre uma receita ou despesa financeira.</DialogDescription>
        </DialogHeader>

        {/* Mobile: 8-step wizard */}
        <div className="md:hidden -mx-6 px-6">
          <div className="flex items-center gap-1 mb-3">
            {WIZARD_STEPS.map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mb-3">Passo {step + 1} de {WIZARD_STEPS.length} — {WIZARD_STEPS[step]}</p>

          <div className="space-y-4 pb-24">
            {step === 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Opcional: anexe uma nota fiscal, boleto ou recibo e use a IA pra preencher os campos automaticamente.</p>
                <FinancialDocumentPanel orgSlug={orgSlug} file={pendingFile} onFileSelected={setPendingFile} onExtracted={applyExtracted} />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <TipoToggle value={tipo} onChange={setTipo} />
                <div className="space-y-1.5">
                  <Label className="text-sm">Valor <span className="text-destructive">*</span></Label>
                  <MoneyInput value={valorCents} onChange={setValorCents} />
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Categoria <span className="text-destructive">*</span></Label>
                  <SettingSelect value={categoria} onChange={setCategoria} options={withExtra(settings.categoria, categoria)} required placeholder="Selecione a categoria" />
                </div>
                <Field label="Subcategoria">
                  <SettingSelect value={subcategoria} onChange={setSubcategoria} options={withExtra(settings.subcategoria, null)} />
                </Field>
                <Field label="Centro de custo">
                  <SettingSelect value={centroCusto} onChange={setCentroCusto} options={withExtra(settings.centro_custo, null)} />
                </Field>
                <div className="space-y-1.5">
                  <Label className="text-sm">Observações / descrição</Label>
                  <Textarea rows={3} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: pagamento de comissão do consultor X" />
                </div>
                <Field label="Cliente ou fornecedor">
                  <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => setContatoId(lead?.id ?? null)} />
                </Field>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm">Competência</Label>
                  <Input type="date" inputMode="none" className="h-12 text-base" value={competencia} onChange={e => setCompetencia(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Vencimento</Label>
                  <Input type="date" inputMode="none" className="h-12 text-base" value={vencimento} onChange={e => setVencimento(e.target.value)} />
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-4">
                <Field label="Conta bancária">
                  <SettingSelect value={contaBancaria} onChange={setContaBancaria} options={withExtra(settings.conta_bancaria, null)} />
                </Field>
                <Field label="Forma de pagamento">
                  <SettingSelect value={formaPagamento} onChange={setFormaPagamento} options={withExtra(settings.forma_pagamento, null)} />
                </Field>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-base py-2 cursor-pointer">
                  <Checkbox className="h-5 w-5" checked={isRecurring} onCheckedChange={v => { setIsRecurring(v === true); if (v) setIsInstallment(false) }} />
                  <span className="flex items-center gap-1.5"><Repeat className="w-4 h-4 text-muted-foreground" /> Possui recorrência?</span>
                </label>
                {isRecurring && (
                  <RecurrenceFields
                    frequency={frequency} setFrequency={setFrequency}
                    count={recCount} setCount={setRecCount}
                    until={recUntil} setUntil={setRecUntil}
                    infinite={recInfinite} setInfinite={setRecInfinite}
                  />
                )}
                {!isRecurring && <p className="text-xs text-muted-foreground">Deixe desmarcado se for um lançamento único.</p>}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-4">
                <label className="flex items-center gap-2 text-base py-2 cursor-pointer">
                  <Checkbox className="h-5 w-5" checked={isInstallment} onCheckedChange={v => { setIsInstallment(v === true); if (v) setIsRecurring(false) }} />
                  <span className="flex items-center gap-1.5"><CreditCard className="w-4 h-4 text-muted-foreground" /> Compra parcelada?</span>
                </label>
                {isInstallment && (
                  <div className="grid gap-3 rounded-lg border bg-muted/20 p-3">
                    <Field label="Quantidade de parcelas">
                      <Input type="number" inputMode="numeric" className="h-12 text-base" min={2} max={60} value={installmentTotal} onChange={e => setInstallmentTotal(Math.max(2, Number(e.target.value) || 2))} />
                    </Field>
                    <Field label="Intervalo entre parcelas (dias)">
                      <Input type="number" inputMode="numeric" className="h-12 text-base" min={1} value={installmentInterval} onChange={e => setInstallmentInterval(Math.max(1, Number(e.target.value) || 30))} />
                    </Field>
                    <p className="text-[11px] text-muted-foreground">
                      Valor por parcela: {formatCurrency(Math.round(valorCents / installmentTotal))} × {installmentTotal} (1ª parcela em {fmtDate(vencimento || competencia)}).
                    </p>
                  </div>
                )}
                {!isInstallment && <p className="text-xs text-muted-foreground">Deixe desmarcado se não for uma compra parcelada.</p>}
              </div>
            )}

            {step === 7 && (
              <div className="space-y-4">
                <div className="rounded-lg border p-3 space-y-2.5 text-sm">
                  <div className="flex items-center gap-1.5">
                    {tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                    <span className={cn('font-semibold text-lg tabular-nums', tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                      {formatCurrency(valorCents)}
                    </span>
                  </div>
                  <dl className="space-y-1.5 text-xs">
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Categoria</dt><dd className="text-right truncate">{categoria || '—'}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vencimento</dt><dd>{fmtDate(vencimento || competencia)}</dd></div>
                    <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd>Pendente</dd></div>
                  </dl>
                  {previewDates.length > 0 && (
                    <div>
                      <p className="text-xs font-medium mb-1">{isInstallment ? `${installmentTotal} parcelas` : 'Próximas ocorrências'}</p>
                      <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-24 overflow-y-auto">
                        {previewDates.slice(0, 8).map(d => <li key={d}>{fmtDate(d)}</li>)}
                        {previewDates.length > 8 && <li>+ {previewDates.length - 8} mais…</li>}
                      </ul>
                    </div>
                  )}
                  {previewDates.length > 20 && (
                    <p className="text-[11px] text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Isso vai gerar {previewDates.length + 1} lançamentos.</p>
                  )}
                </div>

                <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setShowMore(v => !v)}>
                  {showMore ? 'Ocultar informações complementares' : 'Informações complementares (opcional)'}
                </button>
                {showMore && (
                  <div className="space-y-3">
                    <Field label="Número do documento"><Input value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} /></Field>
                    <Field label="Nota fiscal"><Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} /></Field>
                    <Field label="Projeto"><Input value={projeto} onChange={e => setProjeto(e.target.value)} /></Field>
                    <Field label="Unidade de negócio"><Input value={unidadeNegocio} onChange={e => setUnidadeNegocio(e.target.value)} /></Field>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-3 flex gap-2 z-50">
            {step > 0 && (
              <Button type="button" variant="outline" className="h-12" disabled={creating} onClick={goBack}>Voltar</Button>
            )}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="button" className="flex-1 h-12 text-base" onClick={goNext}>Avançar</Button>
            ) : (
              <Button type="button" className="flex-1 h-12 text-base" disabled={creating} onClick={() => handleCreate(false)}>
                {creating ? 'Criando…' : 'Confirmar lançamento'}
              </Button>
            )}
          </div>
        </div>

        {/* Desktop: single-page two-column form */}
        <div className="hidden md:grid gap-5 md:grid-cols-[1fr_260px]">
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> Anexo (opcional)</Label>
              <FinancialDocumentPanel orgSlug={orgSlug} file={pendingFile} onFileSelected={setPendingFile} onExtracted={applyExtracted} />
            </div>

            <TipoToggle value={tipo} onChange={setTipo} />

            <div className="space-y-1">
              <Label className="text-xs">Observações / descrição</Label>
              <Textarea rows={2} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Ex.: pagamento de comissão do consultor X" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs">Categoria <span className="text-destructive">*</span></Label>
                <SettingSelect value={categoria} onChange={setCategoria} options={withExtra(settings.categoria, categoria)} required placeholder="Selecione a categoria" />
              </div>
              <Field label="Subcategoria">
                <SettingSelect value={subcategoria} onChange={setSubcategoria} options={withExtra(settings.subcategoria, null)} />
              </Field>
              <Field label="Centro de custo">
                <SettingSelect value={centroCusto} onChange={setCentroCusto} options={withExtra(settings.centro_custo, null)} />
              </Field>
              <div className="space-y-1">
                <Label className="text-xs">Valor <span className="text-destructive">*</span></Label>
                <MoneyInput value={valorCents} onChange={setValorCents} />
              </div>
              <Field label="Conta bancária">
                <SettingSelect value={contaBancaria} onChange={setContaBancaria} options={withExtra(settings.conta_bancaria, null)} />
              </Field>
              <Field label="Forma de pagamento">
                <SettingSelect value={formaPagamento} onChange={setFormaPagamento} options={withExtra(settings.forma_pagamento, null)} />
              </Field>
              <div className="space-y-1">
                <Label className="text-xs">Competência</Label>
                <Input type="date" value={competencia} onChange={e => setCompetencia(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Vencimento</Label>
                <Input type="date" value={vencimento} onChange={e => setVencimento(e.target.value)} />
              </div>
            </div>

            <Field label="Cliente ou fornecedor">
              <LeadCombobox orgSlug={orgSlug} name="contato_id" placeholder="Buscar contato…" onChange={lead => setContatoId(lead?.id ?? null)} />
            </Field>

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={isRecurring} onCheckedChange={v => { setIsRecurring(v === true); if (v) setIsInstallment(false) }} />
              <span className="flex items-center gap-1.5"><Repeat className="w-3.5 h-3.5 text-muted-foreground" /> Possui recorrência?</span>
            </label>
            {isRecurring && (
              <RecurrenceFields
                frequency={frequency} setFrequency={setFrequency}
                count={recCount} setCount={setRecCount}
                until={recUntil} setUntil={setRecUntil}
                infinite={recInfinite} setInfinite={setRecInfinite}
              />
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={isInstallment} onCheckedChange={v => { setIsInstallment(v === true); if (v) setIsRecurring(false) }} />
              <span className="flex items-center gap-1.5"><CreditCard className="w-3.5 h-3.5 text-muted-foreground" /> Compra parcelada (cartão de crédito, etc.)</span>
            </label>
            {isInstallment && (
              <div className="grid gap-2.5 sm:grid-cols-2 rounded-lg border bg-muted/20 p-3">
                <Field label="Quantidade de parcelas">
                  <Input type="number" min={2} max={60} value={installmentTotal} onChange={e => setInstallmentTotal(Math.max(2, Number(e.target.value) || 2))} />
                </Field>
                <Field label="Intervalo entre parcelas (dias)">
                  <Input type="number" min={1} value={installmentInterval} onChange={e => setInstallmentInterval(Math.max(1, Number(e.target.value) || 30))} />
                </Field>
                <p className="text-[11px] text-muted-foreground sm:col-span-2">
                  Valor por parcela: {formatCurrency(Math.round(valorCents / installmentTotal))} × {installmentTotal} (1ª parcela em {fmtDate(vencimento || competencia)}).
                </p>
              </div>
            )}

            <button type="button" className="text-xs text-muted-foreground hover:text-foreground underline" onClick={() => setShowMore(v => !v)}>
              {showMore ? 'Ocultar informações complementares' : 'Informações complementares (opcional)'}
            </button>
            {showMore && (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <Field label="Número do documento"><Input value={numeroDocumento} onChange={e => setNumeroDocumento(e.target.value)} /></Field>
                <Field label="Nota fiscal"><Input value={notaFiscal} onChange={e => setNotaFiscal(e.target.value)} /></Field>
                <Field label="Projeto"><Input value={projeto} onChange={e => setProjeto(e.target.value)} /></Field>
                <Field label="Unidade de negócio"><Input value={unidadeNegocio} onChange={e => setUnidadeNegocio(e.target.value)} /></Field>
              </div>
            )}
          </div>

          <div className="border-l pl-4 py-2 space-y-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resumo</p>
            <div className="flex items-center gap-1.5">
              {tipo === 'receita' ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
              <span className={cn('font-semibold tabular-nums', tipo === 'receita' ? 'text-success' : 'text-destructive')}>
                {formatCurrency(valorCents)}
              </span>
            </div>
            <dl className="space-y-1.5 text-xs">
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Categoria</dt><dd className="text-right truncate">{categoria || '—'}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Vencimento</dt><dd>{fmtDate(vencimento || competencia)}</dd></div>
              <div className="flex justify-between gap-2"><dt className="text-muted-foreground">Status</dt><dd>Pendente</dd></div>
            </dl>
            {previewDates.length > 0 && (
              <div>
                <p className="text-xs font-medium mb-1 flex items-center gap-1">
                  {isInstallment ? `${installmentTotal} parcelas` : 'Próximas ocorrências'}
                </p>
                <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-32 overflow-y-auto">
                  {previewDates.slice(0, 12).map(d => <li key={d}>{fmtDate(d)}</li>)}
                  {previewDates.length > 12 && <li>+ {previewDates.length - 12} mais…</li>}
                </ul>
              </div>
            )}
            {previewDates.length > 20 && (
              <p className="text-[11px] text-warning flex items-center gap-1"><AlertTriangle className="w-3 h-3 shrink-0" /> Isso vai gerar {previewDates.length + 1} lançamentos.</p>
            )}
          </div>
        </div>

        <DialogFooter className="hidden md:flex">
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" disabled={creating} onClick={() => handleCreate(true)}>Salvar e criar outro</Button>
          <Button disabled={creating} onClick={() => handleCreate(false)}>{creating ? 'Criando…' : 'Criar lançamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

