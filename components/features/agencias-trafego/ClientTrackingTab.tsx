import { Card, CardContent } from '@/components/ui/card'
import { Waypoints } from 'lucide-react'

/**
 * Aba Tracking — esqueleto pronto pra receber integração de rastreamento de
 * funil (UTMify, Tintin, etc.) no futuro. Arquitetura pensada pra ser
 * extensível a mais de um fornecedor (sem integração real nesta fase — ver
 * plano em C:\Users\aleft\.claude\plans\dazzling-baking-anchor.md).
 */
export default function ClientTrackingTab() {
  return (
    <Card>
      <CardContent className="py-12 text-center space-y-2">
        <Waypoints className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium">Nenhuma integração de tracking conectada ainda.</p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Quando conectado (UTMify, Tintin ou outra plataforma), esta aba vai mostrar o funil completo —
          investimento → cliques → leads → leads qualificados → oportunidades → vendas → receita — com
          CPL/CPA/CAC/ROAS/ROI calculados automaticamente.
        </p>
      </CardContent>
    </Card>
  )
}
