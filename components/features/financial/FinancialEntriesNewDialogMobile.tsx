'use client'

/**
 * Mobile 8-step wizard for NewEntryDialog. Prop-driven, split out of
 * FinancialEntriesNewDialog.tsx.
 */

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn, formatCurrency } from '@/lib/utils'
import type { FinancialSettingType, FinancialSettingRow } from '@/actions/financial-settings'
import FinancialDocumentPanel from './FinancialDocumentPanel'
import LeadCombobox from '@/components/features/LeadCombobox'
import type { RecurrenceFrequency } from '@/lib/financial/recurrence'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import {
  TrendingUp, TrendingDown, Repeat, CreditCard, AlertTriangle,
} from 'lucide-react'
import {
  fmtDate, MoneyInput, Field, SettingSelect, withExtra, TipoToggle,
} from './FinancialEntriesShared'
import { RecurrenceFields } from './FinancialEntriesNewDialog'

export const WIZARD_STEPS = ['Anexo', 'Tipo', 'Informações básicas', 'Datas', 'Pagamento', 'Recorrência', 'Parcelamento', 'Resumo']

export function NewEntryDialogMobileWizard({
  orgSlug, settings, step, goNext, goBack, creating, onSubmit,
  pendingFile, setPendingFile, applyExtracted,
  tipo, setTipo, valorCents, setValorCents,
  categoria, setCategoria, subcategoria, setSubcategoria, centroCusto, setCentroCusto,
  observacoes, setObservacoes, setContatoId,
  competencia, setCompetencia, vencimento, setVencimento,
  contaBancaria, setContaBancaria, formaPagamento, setFormaPagamento,
  isRecurring, setIsRecurring, setIsInstallment,
  frequency, setFrequency, recCount, setRecCount, recUntil, setRecUntil, recInfinite, setRecInfinite,
  isInstallment, installmentTotal, setInstallmentTotal, installmentInterval, setInstallmentInterval,
  previewDates, showMore, setShowMore,
  numeroDocumento, setNumeroDocumento, notaFiscal, setNotaFiscal, projeto, setProjeto,
  unidadeNegocio, setUnidadeNegocio,
}: {
  orgSlug: string
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
  step: number
  goNext: () => void
  goBack: () => void
  creating: boolean
  onSubmit: () => void
  pendingFile: File | null
  setPendingFile: (f: File | null) => void
  applyExtracted: (data: ExtractedFinancialDocument) => void
  tipo: 'receita' | 'despesa'
  setTipo: (t: 'receita' | 'despesa') => void
  valorCents: number
  setValorCents: (n: number) => void
  categoria: string | null
  setCategoria: (v: string | null) => void
  subcategoria: string | null
  setSubcategoria: (v: string | null) => void
  centroCusto: string | null
  setCentroCusto: (v: string | null) => void
  observacoes: string
  setObservacoes: (v: string) => void
  setContatoId: (v: string | null) => void
  competencia: string
  setCompetencia: (v: string) => void
  vencimento: string
  setVencimento: (v: string) => void
  contaBancaria: string | null
  setContaBancaria: (v: string | null) => void
  formaPagamento: string | null
  setFormaPagamento: (v: string | null) => void
  isRecurring: boolean
  setIsRecurring: (v: boolean) => void
  setIsInstallment: (v: boolean) => void
  frequency: RecurrenceFrequency
  setFrequency: (f: RecurrenceFrequency) => void
  recCount: number
  setRecCount: (n: number) => void
  recUntil: string
  setRecUntil: (v: string) => void
  recInfinite: boolean
  setRecInfinite: (v: boolean) => void
  isInstallment: boolean
  installmentTotal: number
  setInstallmentTotal: (n: number) => void
  installmentInterval: number
  setInstallmentInterval: (n: number) => void
  previewDates: string[]
  showMore: boolean
  setShowMore: (v: boolean | ((prev: boolean) => boolean)) => void
  numeroDocumento: string
  setNumeroDocumento: (v: string) => void
  notaFiscal: string
  setNotaFiscal: (v: string) => void
  projeto: string
  setProjeto: (v: string) => void
  unidadeNegocio: string
  setUnidadeNegocio: (v: string) => void
}) {
  return (
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
          <Button type="button" className="flex-1 h-12 text-base" disabled={creating} onClick={onSubmit}>
            {creating ? 'Criando…' : 'Confirmar lançamento'}
          </Button>
        )}
      </div>
    </div>
  )
}

