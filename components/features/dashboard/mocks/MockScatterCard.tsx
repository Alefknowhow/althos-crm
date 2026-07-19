import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users } from 'lucide-react'
import MockBadge from '../MockBadge'
import MockScatterChart, { type MockScatterPoint } from './MockScatterChart'

const MOCK_POINTS: MockScatterPoint[] = [
  { name: 'A', frequency: 1, ticket: 320 },
  { name: 'B', frequency: 2, ticket: 410 },
  { name: 'C', frequency: 2, ticket: 890 },
  { name: 'D', frequency: 3, ticket: 260 },
  { name: 'E', frequency: 4, ticket: 610 },
  { name: 'F', frequency: 5, ticket: 1200 },
  { name: 'G', frequency: 6, ticket: 740 },
  { name: 'H', frequency: 8, ticket: 1550 },
  { name: 'I', frequency: 1, ticket: 150 },
  { name: 'J', frequency: 3, ticket: 980 },
]

export default function MockScatterCard() {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            Perfil de compra
          </CardTitle>
          <MockBadge />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Frequência de compra × ticket médio por cliente — ajuda a identificar clientes de alto valor.
        </p>
      </CardHeader>
      <CardContent className="flex-1">
        <MockScatterChart points={MOCK_POINTS} />
      </CardContent>
    </Card>
  )
}
