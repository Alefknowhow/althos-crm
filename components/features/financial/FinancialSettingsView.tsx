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
  createFinancialSetting, deleteFinancialSetting, updateFinancialSettingPaymentDay,
  type FinancialSettingType, type FinancialSettingRow,
} from '@/actions/financial-settings'
import { FINANCIAL_SETTING_TYPES } from '@/lib/financial-settings-types'

export default function FinancialSettingsView({
  orgSlug, settings,
}: {
  orgSlug: string
  settings: Record<FinancialSettingType, FinancialSettingRow[]>
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
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

  async function handlePaymentDay(id: string, day: string) {
    const n = day ? parseInt(day, 10) : null
    const res = await updateFinancialSettingPaymentDay(orgSlug, id, n)
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
            Informe o dia do mês em que cada operadora paga a comissão — a receita da venda é lançada nessa data.
          </p>
        )}

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum item cadastrado ainda.</p>
        ) : (
          <ul className="space-y-1 max-h-64 overflow-y-auto">
            {items.map(item => (
              <li key={item.id} className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5 text-sm">
                <span className="truncate">{item.name}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {isOperadora && (
                    <Input
                      type="number" min={1} max={31}
                      defaultValue={item.payment_day ?? ''}
                      onBlur={e => handlePaymentDay(item.id, e.target.value)}
                      placeholder="dia"
                      title="Dia do mês em que a operadora paga"
                      className="h-7 w-16 text-xs px-2"
                    />
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
