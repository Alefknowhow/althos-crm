'use client'

import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Sparkles, Zap, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { getPublicCreditPackOptions, type CreditPackOption } from '@/actions/ai-credit-pricing'

/**
 * Painel de compra de créditos de IA avulsos — foco em créditos, não em
 * upgrade de plano (esse continua disponível, mas como ação secundária).
 * A cobrança real via Asaas ainda não está ligada: o botão "Comprar" mostra
 * a intenção pro usuário mas não movimenta dinheiro ainda (ver comentário no
 * onClick) — habilitar isso é o próximo passo, depois de validar o preço do
 * crédito calculado em /super-admin/ai-credits.
 */
export default function AiCreditsPanel({
  open,
  onClose,
  available,
  total,
  onUpgradeClick,
}: {
  open: boolean
  onClose: () => void
  available: number
  total: number
  onUpgradeClick: () => void
}) {
  const [packs, setPacks] = useState<CreditPackOption[]>([])
  const [pricePerCredit, setPricePerCredit] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    getPublicCreditPackOptions().then(res => {
      setPacks(res.packs)
      setPricePerCredit(res.pricePerCreditBrlCents)
      setLoading(false)
    })
  }, [open])

  function handleBuy(pack: CreditPackOption) {
    // TODO: integrar cobrança real via Asaas (createPayment avulso) quando o
    // preço do crédito calculado em /super-admin/ai-credits for validado.
    toast.info('Compra de créditos em breve', {
      description: `${pack.credits} créditos por ${fmtBrl(pack.priceBrlCents)} — em desenvolvimento.`,
    })
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Créditos de IA
          </DialogTitle>
          <DialogDescription>
            Você tem <strong>{available}</strong> de {total} créditos disponíveis neste mês.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Compre créditos avulsos sem precisar mudar de plano:</p>

          {loading ? (
            <div className="h-32 rounded-lg bg-muted animate-pulse" />
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {packs.map(pack => (
                <button
                  key={pack.credits}
                  onClick={() => handleBuy(pack)}
                  className="flex flex-col items-center gap-1 rounded-xl border p-3 hover:border-primary/50 hover:bg-primary/5 transition-colors text-center"
                >
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">{pack.credits}</span>
                  <span className="text-[11px] text-muted-foreground">créditos</span>
                  <span className="text-xs font-medium mt-1">{fmtBrl(pack.priceBrlCents)}</span>
                </button>
              ))}
            </div>
          )}
          {!loading && pricePerCredit > 0 && (
            <p className="text-[11px] text-muted-foreground text-center">≈ {(pricePerCredit / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 })} por crédito</p>
          )}
        </div>

        <div className="pt-2 border-t">
          <button
            onClick={onUpgradeClick}
            className="w-full flex items-center justify-between text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
          >
            <span>Precisa de mais créditos todo mês? Veja os planos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function fmtBrl(cents: number) {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}
