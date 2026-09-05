'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from 'recharts'
import { DONUT_COLORS, fmtCurrency } from './MarketingOverviewShared'

export default function MarketingOverviewObjectiveChart({
  byObjectiveData,
}: {
  byObjectiveData: Array<{ name: string; value: number }>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Investimento por objetivo</CardTitle>
      </CardHeader>
      <CardContent>
        {byObjectiveData.length === 0 ? (
          <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
            Sem investimento registrado no período.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={byObjectiveData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={2}
                >
                  {byObjectiveData.map((_, i) => (
                    <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip formatter={(v: any) => [fmtCurrency(Number(v) || 0), 'Investimento']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1 mt-2">
              {byObjectiveData.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }}
                    />
                    <span className="truncate">{s.name}</span>
                  </div>
                  <span className="tabular-nums text-muted-foreground">{fmtCurrency(s.value)}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
