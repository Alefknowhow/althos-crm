'use client'

/**
 * Desktop single-page two-column form for NewEntryDialog. Prop-driven,
 * split out of FinancialEntriesNewDialog.tsx.
 */

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
  Sparkles, TrendingUp, TrendingDown, Repeat, CreditCard, AlertTriangle,
} from 'lucide-react'
import {
  fmtDate, MoneyInput, Field, SettingSelect, withExtra, TipoToggle,
} from './FinancialEntriesShared'
import { RecurrenceFields } from './FinancialEntriesNewDialog'

export function NewEntryDialogDesktopForm({
  orgSlug, settings,
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
  )
}
