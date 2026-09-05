import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import { Loader2, FileIcon, ImageIcon, Sparkles, X } from 'lucide-react'
import VoucherUploadAndReview from '@/components/features/reservas/VoucherUploadAndReview'
import VoucherExtractDialog, { type ExtractSource } from '@/components/features/reservas/VoucherExtractDialog'
import { updateTravelSale, type TravelSaleRow } from '@/actions/travel-sales'
import type { Voucher } from './TravelSalesViewShared'

// Conteúdo da aba "Vouchers" do editor de venda — extraído de
// TravelSalesViewSaleEditor.tsx. Pura movimentação de JSX.
export default function TravelSalesViewSaleEditorVouchersTab({
  orgSlug, s, setS, set, vouchers, extractingUrl, handleExtractFromUrl,
  extractSource, extractOpen, setExtractOpen, extractLabel, mergeExtractedFields, setProductsRefreshKey,
}: {
  orgSlug: string
  s: TravelSaleRow
  setS: React.Dispatch<React.SetStateAction<TravelSaleRow>>
  set: (k: keyof TravelSaleRow, v: any) => void
  vouchers: Voucher[]
  extractingUrl: string | null
  handleExtractFromUrl: (v: Voucher) => void
  extractSource: ExtractSource | null
  extractOpen: boolean
  setExtractOpen: (v: boolean) => void
  extractLabel: string | null
  mergeExtractedFields: (prev: TravelSaleRow, fields: Record<string, any>, sourceLabel: string | null) => TravelSaleRow
  setProductsRefreshKey: React.Dispatch<React.SetStateAction<number>>
}) {
  return (
    <TabsContent value="vouchers" className="pt-4">
      <div className="grid gap-4 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <VoucherUploadAndReview
            orgSlug={orgSlug}
            onVoucherAdded={v => {
              setS(prev => {
                const next = [...(Array.isArray(prev.vouchers) ? prev.vouchers : []), v]
                // Persiste na hora — não depende do botão "Salvar" pra o
                // voucher recém-enviado sobreviver a um refresh/troca de aba.
                updateTravelSale(orgSlug, prev.id, { vouchers: next })
                return { ...prev, vouchers: next }
              })
            }}
          />
        </div>
        <div className="lg:col-span-3">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Vouchers / comprovantes</p>
          {vouchers.length > 0 ? (
            <ul className="space-y-1.5">
              {vouchers.map((v, i) => {
                const isPdf = /\.pdf($|\?)/i.test(v.url) || /\.pdf$/i.test(v.name)
                return (
                  <li key={`${v.url}-${i}`} className="flex items-center gap-2 rounded-lg border bg-muted/30 px-2.5 py-1.5">
                    {isPdf
                      ? <FileIcon className="w-4 h-4 text-rose-500 shrink-0" />
                      : <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />}
                    <a href={v.url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 min-w-0 truncate text-xs text-foreground hover:underline">
                      {v.name || `Voucher ${i + 1}`}
                    </a>
                    <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">Importado pelo agente</span>
                    <Button
                      type="button" size="sm" variant="outline" className="h-7 text-xs shrink-0"
                      disabled={extractingUrl === v.url}
                      onClick={() => handleExtractFromUrl(v)}
                    >
                      {extractingUrl === v.url
                        ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                        : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                      Extrair dados
                    </Button>
                    <button
                      type="button"
                      onClick={() => set('vouchers', vouchers.filter((_, idx) => idx !== i))}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label="Remover voucher"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground border rounded-lg p-4 text-center">Nenhum voucher enviado ainda.</p>
          )}
        </div>
      </div>

      <VoucherExtractDialog
        orgSlug={orgSlug}
        saleId={s.id}
        source={extractSource}
        open={extractOpen}
        onOpenChange={setExtractOpen}
        onScalarFieldsExtracted={fields => setS(prev => mergeExtractedFields(prev, fields, extractLabel))}
        onTravelersExtracted={others => {
          setS(prev => {
            const existing: { name?: string; birth_date?: string; cpf?: string }[] = Array.isArray(prev.travelers) ? prev.travelers : []
            const existingNames = new Set(existing.map(t => (t.name || '').trim().toLowerCase()))
            const toAdd = others.filter(o => !existingNames.has(o.name.trim().toLowerCase()))
            return toAdd.length > 0 ? { ...prev, travelers: [...existing, ...toAdd] } : prev
          })
        }}
        onProductCreated={() => setProductsRefreshKey(k => k + 1)}
      />
    </TabsContent>
  )
}
