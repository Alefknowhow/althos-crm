'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Trash2, Pause, Play, Megaphone } from 'lucide-react'
import { deleteCampaign, updateCampaign } from '@/actions/marketing'

type CampaignRow = {
  id: string
  name: string
  color: string | null
  status: string
  provider: string
  account_name: string
  spend_cents: number
  impressions: number
  clicks: number
  leads: number
  cpl_cents: number | null
  ctr: number
}

const PROVIDER_LABEL: Record<string, string> = {
  meta: 'Meta',
  google: 'Google',
  tiktok: 'TikTok',
  other: 'Outro',
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function fmtNumber(n: number): string {
  return new Intl.NumberFormat('pt-BR').format(n)
}

export default function CampaignsTable({
  orgSlug,
  rows,
  onRefresh,
}: {
  orgSlug: string
  rows: CampaignRow[]
  onRefresh: () => void
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)

  async function toggleStatus(row: CampaignRow) {
    setBusyId(row.id)
    const nextStatus = row.status === 'active' ? 'paused' : 'active'
    const res = await updateCampaign(orgSlug, row.id, { status: nextStatus })
    setBusyId(null)
    if (res.ok) {
      toast.success(nextStatus === 'active' ? 'Campanha ativada' : 'Campanha pausada')
      onRefresh()
    } else {
      toast.error(res.error)
    }
  }

  async function handleDelete(row: CampaignRow) {
    if (!window.confirm(`Excluir "${row.name}"? Métricas registradas serão removidas.`)) return
    setBusyId(row.id)
    const res = await deleteCampaign(orgSlug, row.id)
    setBusyId(null)
    if (res.ok) {
      toast.success('Excluída')
      onRefresh()
    } else {
      toast.error(res.error)
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Desempenho das campanhas</CardTitle>
        <Badge variant="secondary" className="text-xs">
          {rows.length} campanha{rows.length === 1 ? '' : 's'}
        </Badge>
      </CardHeader>
      <CardContent className="p-0">
        {rows.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground space-y-3">
            <Megaphone className="w-10 h-10 mx-auto opacity-40" />
            <p>Nenhuma campanha cadastrada ainda.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Investimento</TableHead>
                  <TableHead className="text-right">Impressões</TableHead>
                  <TableHead className="text-right">Cliques</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: r.color || '#3b82f6' }}
                        />
                        <div>
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.account_name}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {PROVIDER_LABEL[r.provider] || r.provider}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtCurrency(r.spend_cents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtNumber(r.impressions)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {fmtNumber(r.clicks)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.ctr.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {r.leads}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {r.cpl_cents != null ? fmtCurrency(r.cpl_cents) : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          r.status === 'active'
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : r.status === 'paused'
                              ? 'bg-amber-100 text-amber-700 border-amber-200'
                              : 'bg-muted text-muted-foreground'
                        }
                      >
                        {r.status === 'active' ? 'Ativa' : r.status === 'paused' ? 'Pausada' : r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleStatus(r)}
                          disabled={busyId === r.id}
                          title={r.status === 'active' ? 'Pausar' : 'Ativar'}
                        >
                          {r.status === 'active' ? (
                            <Pause className="w-3.5 h-3.5" />
                          ) : (
                            <Play className="w-3.5 h-3.5" />
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(r)}
                          disabled={busyId === r.id}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
