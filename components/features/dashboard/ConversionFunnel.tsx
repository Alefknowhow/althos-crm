import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface FunnelStep {
  name: string
  value: number
  conversionRate: number
}

interface ConversionFunnelProps {
  data: FunnelStep[]
}

export default function ConversionFunnel({ data }: ConversionFunnelProps) {
  const maxValue = Math.max(...data.map(d => d.value), 1)

  return (
    <Card className="reveal">
      <CardHeader className="pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Funil de conversão</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {data.map((step, index) => {
          const widthPct = (step.value / maxValue) * 100
          return (
            <div key={step.name}>
              <div className="flex justify-between items-baseline mb-1.5 text-sm">
                <span className="font-medium tracking-apple-snug text-foreground">{step.name}</span>
                <span className="text-xs text-muted-foreground tracking-apple-snug tabular-nums">
                  {step.value} {step.value === 1 ? 'lead' : 'leads'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-apple"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                {index > 0 && (
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums w-10 text-right tracking-apple-snug">
                    {step.conversionRate.toFixed(1)}%
                  </span>
                )}
                {index === 0 && <span className="w-10" />}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
