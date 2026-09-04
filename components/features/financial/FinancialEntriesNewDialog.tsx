'use client'

/**
 * The recurrence-fields sub-form and the new-entry dialog for
 * FinancialEntriesView. Split out of FinancialEntriesView.tsx.
 */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { createFinancialEntry, uploadFinancialAttachment } from '@/actions/financial'
import type { FinancialSettingType, FinancialSettingRow } from '@/actions/financial-settings'
import {
  FREQUENCY_LABELS, computeRecurrenceDates, computeInstallmentDates, type RecurrenceFrequency,
} from '@/lib/financial/recurrence'
import type { ExtractedFinancialDocument } from '@/lib/ai/financial-document-extract'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { Field } from './FinancialEntriesShared'
import { NewEntryDialogMobileWizard } from './FinancialEntriesNewDialogMobile'
import { NewEntryDialogDesktopForm } from './FinancialEntriesNewDialogDesktop'

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
        <NewEntryDialogMobileWizard
          orgSlug={orgSlug}
          settings={settings}
          step={step}
          goNext={goNext}
          goBack={goBack}
          creating={creating}
          onSubmit={() => handleCreate(false)}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
          applyExtracted={applyExtracted}
          tipo={tipo} setTipo={setTipo}
          valorCents={valorCents} setValorCents={setValorCents}
          categoria={categoria} setCategoria={setCategoria}
          subcategoria={subcategoria} setSubcategoria={setSubcategoria}
          centroCusto={centroCusto} setCentroCusto={setCentroCusto}
          observacoes={observacoes} setObservacoes={setObservacoes}
          setContatoId={setContatoId}
          competencia={competencia} setCompetencia={setCompetencia}
          vencimento={vencimento} setVencimento={setVencimento}
          contaBancaria={contaBancaria} setContaBancaria={setContaBancaria}
          formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento}
          isRecurring={isRecurring} setIsRecurring={setIsRecurring}
          setIsInstallment={setIsInstallment}
          frequency={frequency} setFrequency={setFrequency}
          recCount={recCount} setRecCount={setRecCount}
          recUntil={recUntil} setRecUntil={setRecUntil}
          recInfinite={recInfinite} setRecInfinite={setRecInfinite}
          isInstallment={isInstallment}
          installmentTotal={installmentTotal} setInstallmentTotal={setInstallmentTotal}
          installmentInterval={installmentInterval} setInstallmentInterval={setInstallmentInterval}
          previewDates={previewDates}
          showMore={showMore} setShowMore={setShowMore}
          numeroDocumento={numeroDocumento} setNumeroDocumento={setNumeroDocumento}
          notaFiscal={notaFiscal} setNotaFiscal={setNotaFiscal}
          projeto={projeto} setProjeto={setProjeto}
          unidadeNegocio={unidadeNegocio} setUnidadeNegocio={setUnidadeNegocio}
        />

        {/* Desktop: single-page two-column form */}
        <NewEntryDialogDesktopForm
          orgSlug={orgSlug}
          settings={settings}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
          applyExtracted={applyExtracted}
          tipo={tipo} setTipo={setTipo}
          valorCents={valorCents} setValorCents={setValorCents}
          categoria={categoria} setCategoria={setCategoria}
          subcategoria={subcategoria} setSubcategoria={setSubcategoria}
          centroCusto={centroCusto} setCentroCusto={setCentroCusto}
          observacoes={observacoes} setObservacoes={setObservacoes}
          setContatoId={setContatoId}
          competencia={competencia} setCompetencia={setCompetencia}
          vencimento={vencimento} setVencimento={setVencimento}
          contaBancaria={contaBancaria} setContaBancaria={setContaBancaria}
          formaPagamento={formaPagamento} setFormaPagamento={setFormaPagamento}
          isRecurring={isRecurring} setIsRecurring={setIsRecurring}
          setIsInstallment={setIsInstallment}
          frequency={frequency} setFrequency={setFrequency}
          recCount={recCount} setRecCount={setRecCount}
          recUntil={recUntil} setRecUntil={setRecUntil}
          recInfinite={recInfinite} setRecInfinite={setRecInfinite}
          isInstallment={isInstallment}
          installmentTotal={installmentTotal} setInstallmentTotal={setInstallmentTotal}
          installmentInterval={installmentInterval} setInstallmentInterval={setInstallmentInterval}
          previewDates={previewDates}
          showMore={showMore} setShowMore={setShowMore}
          numeroDocumento={numeroDocumento} setNumeroDocumento={setNumeroDocumento}
          notaFiscal={notaFiscal} setNotaFiscal={setNotaFiscal}
          projeto={projeto} setProjeto={setProjeto}
          unidadeNegocio={unidadeNegocio} setUnidadeNegocio={setUnidadeNegocio}
        />

        <DialogFooter className="hidden md:flex">
          <Button variant="outline" disabled={creating} onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" disabled={creating} onClick={() => handleCreate(true)}>Salvar e criar outro</Button>
          <Button disabled={creating} onClick={() => handleCreate(false)}>{creating ? 'Criando…' : 'Criar lançamento'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

