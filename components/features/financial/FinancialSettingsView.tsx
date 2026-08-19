'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { Plus, X, Loader2 } from 'lucide-react'
import {
  createFinancialSetting, deleteFinancialSetting, updateFinancialSettingPaymentSchedule,
  type FinancialSettingType, type FinancialSettingRow, type PaymentScheduleType,
} from '@/actions/financial-settings'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { FINANCIAL_SETTING_TYPES } from '@/lib/financial-settings-types'

export default function FinancialSettingsView({
  orgSlug, settings,
}: {
  orgSlug: string
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
}) {
  return (
    <div className="max-w-5xl mx-auto grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {FINANCIAL_SETTING_TYPES.map(({ type, label }) => (
        <SettingListCard key={type} orgSlug={orgSlug} type={type} label={label} items={settings[type] || []} />
      ))}
    </div>
  )
}

function SettingListCard({
  orgSlug, type, label, items,
}: {
  orgSlug: string
  type: FinancialSettingType
  label: string
  items: FinancialSettingRow[]
}) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  async function handleAdd() {
    if (!value.trim()) return
    setAdding(true)
    const res = await createFinancialSetting(orgSlug, type, value)
    setAdding(false)
    if (!res.ok) { toast.error(res.error); return }
    setValue('')
    router.refresh()
  }

  async function handleDelete(id: string) {
    const res = await deleteFinancialSetting(orgSlug, id)
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  async function handleScheduleType(item: FinancialSettingRow, scheduleType: PaymentScheduleType) {
    const res = await updateFinancialSettingPaymentSchedule(orgSlug, item.id, {
      scheduleType,
      paymentDay: scheduleType === 'dia_fixo' ? item.payment_day : null,
      offsetDays: scheduleType === 'decendio' ? item.payment_offset_days : null,
    })
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  async function handlePaymentDay(item: FinancialSettingRow, day: string) {
    const n = day ? parseInt(day, 10) : null
    const res = await updateFinancialSettingPaymentSchedule(orgSlug, item.id, {
      scheduleType: 'dia_fixo', paymentDay: n, offsetDays: null,
    })
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  async function handleOffsetDays(item: FinancialSettingRow, days: string) {
    const n = days ? parseInt(days, 10) : null
    const res = await updateFinancialSettingPaymentSchedule(orgSlug, item.id, {
      scheduleType: 'decendio', paymentDay: null, offsetDays: n,
    })
    if (res.ok) router.refresh()
    else toast.error(res.error)
  }

  const isOperadora = type === 'operadora'

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-1.5">
          <Input
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAdd() } }}
            placeholder="Adicionar item…"
            className="h-9"
          />
          <Button size="sm" className="h-9 shrink-0" disabled={adding || !value.trim()} onClick={handleAdd}>
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </Button>
        </div>
        {isOperadora && (
          <p className="text-[11px] text-muted-foreground -mt-1.5">
            Configure como cada operadora paga a comissão — a receita da venda é lançada na data
            calculada. &quot;Dia fixo&quot; paga sempre no mesmo dia do mês; &quot;Decêndio&quot; paga X dias depois
            que o bloco de 10 dias (1-10, 11-20, 21-fim) em que a venda caiu se fecha.
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item cadastrado ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-sm">
                <span className="truncate">{item.name}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isOperadora && (
                    <>
                      <Select
                        value={item.payment_schedule_type}
                        onValueChange={v => handleScheduleType(item, v as PaymentScheduleType)}
                      >
                        <SelectTrigger className="h-7 w-[110px] text-xs px-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="dia_fixo">Dia fixo</SelectItem>
                          <SelectItem value="decendio">Decêndio</SelectItem>
                        </SelectContent>
                      </Select>
                      {item.payment_schedule_type === 'decendio' ? (
                        <Input
                          type="number" min={0} max={60}
                          defaultValue={item.payment_offset_days ?? ''}
                          onBlur={e => handleOffsetDays(item, e.target.value)}
                          placeholder="dias"
                          title="Dias após o fechamento do decêndio em que a operadora paga"
                          className="h-7 w-16 text-xs px-2"
                        />
                      ) : (
                        <Input
                          type="number" min={1} max={31}
                          defaultValue={item.payment_day ?? ''}
                          onBlur={e => handlePaymentDay(item, e.target.value)}
                          placeholder="dia"
                          title="Dia do mês em que a operadora paga"
                          className="h-7 w-16 text-xs px-2"
                        />
                      )}
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => setDeleteId(item.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={`Remover ${item.name}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={o => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item</AlertDialogTitle>
            <AlertDialogDescription>
              Lançamentos que já usam esse valor não são alterados — o item só deixa de aparecer nas opções de novos lançamentos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { handleDelete(deleteId!); setDeleteId(null) }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
