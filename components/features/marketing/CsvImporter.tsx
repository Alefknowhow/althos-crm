'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { bulkRecordCampaignMetrics } from '@/actions/marketing'
import { normalizeHeader, detectColumn, parseDate, parseMoney, parseCsv } from '@/lib/csv'

type Campaign = { id: string; name: string }

type ParsedRow = {
  rowNum: number
  campaign_name: string
  date: string
  spend_cents: number
  impressions: number
  clicks: number
  matched: boolean
  campaign_id?: string
  warning?: string
}

/**
 * Header detection — keys we accept (case-insensitive, with diacritic stripping).
 * Meta and Google Ads exports vary, so we maintain a per-field synonym list.
 */
// All synonyms are matched after lowercasing + diacritic stripping, so we
// write them without accents on the Portuguese side.
const HEADER_SYNONYMS = {
  campaign: [
    'campaign name',
    'campaign',
    'campanha',
    'nome da campanha',
  ],
  // Daily date column. With "Por dia" enabled, Meta BR exports each day as a
  // row where "Início dos relatórios" == "Encerramento dos relatórios" — so
  // we accept the start-of-report column as the per-row date. Without "Por
  // dia" the user gets a single row spanning the whole period; we detect
  // that mistake during row parsing and warn.
  date: [
    'day',
    'date',
    'data',
    'dia',
    'reporting starts', // Meta English
    'inicio dos relatorios', // Meta BR (after diacritic strip)
    'início dos relatórios',
    'data do relatorio',
    'data do relatório',
  ],
  spend: [
    'amount spent (brl)',
    'amount spent',
    'amount spent (usd)',
    'spend',
    'cost',
    'custo',
    'custo (brl)',
    'investimento',
    'valor gasto',
    'valor investido',
    'valor usado', // ← Meta BR
    'valor usado (brl)', // ← Meta BR with currency
  ],
  impressions: [
    'impressions',
    'impressoes',
    'impressões',
    'impr.',
    'impr',
  ],
  clicks: [
    'link clicks',
    'clicks',
    'cliques',
    'cliques no link',
    'cliques (todos)',
  ],
} as const

// Columns that signal a "period rollup" export (no per-day rows). When we
// detect these AND no daily date column, we ask the user to re-export with
// the "Por dia" breakdown enabled — importing a single row that aggregates
// 30 days of spend into one date is misleading.
const PERIOD_START_SYNONYMS = [
  'inicio dos relatorios',
  'início dos relatórios',
  'reporting starts',
]
const PERIOD_END_SYNONYMS = [
  'encerramento dos relatorios',
  'encerramento dos relatórios',
  'reporting ends',
]

export default function CsvImporter({
  orgSlug,
  campaigns,
}: {
  orgSlug: string
  campaigns: Campaign[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = String(e.target?.result || '')
      const { headers: hdrs, rows } = parseCsv(text)

      if (rows.length === 0) {
        toast.error('CSV vazio ou inválido')
        return
      }

      const idxCampaign = detectColumn(hdrs, HEADER_SYNONYMS.campaign)
      const idxDate = detectColumn(hdrs, HEADER_SYNONYMS.date)
      const idxSpend = detectColumn(hdrs, HEADER_SYNONYMS.spend)
      const idxImpressions = detectColumn(hdrs, HEADER_SYNONYMS.impressions)
      const idxClicks = detectColumn(hdrs, HEADER_SYNONYMS.clicks)
      // End-of-period column is used only to detect non-daily exports
      // (start != end on the same row → user forgot "Por dia").
      const idxPeriodEnd = detectColumn(hdrs, PERIOD_END_SYNONYMS)

      const missing: string[] = []
      if (idxCampaign < 0) missing.push('Nome da campanha')
      if (idxDate < 0) missing.push('Data / Dia')
      if (idxSpend < 0) missing.push('Investimento / Valor usado')

      if (missing.length > 0) {
        toast.error(
          `Não consegui identificar: ${missing.join(', ')}. Colunas encontradas: ${hdrs.join(', ')}`,
          { duration: 12000 },
        )
        console.warn('CSV column detection failed', { missing, headers: hdrs })
        return
      }

      const byName = new Map<string, string>()
      for (const c of campaigns) byName.set(c.name.toLowerCase().trim(), c.id)

      const out: ParsedRow[] = rows.map((row, i) => {
        const campaignName = (row[idxCampaign] || '').trim()
        const dateRaw = row[idxDate] || ''
        const date = parseDate(dateRaw) || ''
        const endRaw = idxPeriodEnd >= 0 ? row[idxPeriodEnd] || '' : ''
        const endDate = endRaw ? parseDate(endRaw) || '' : ''
        // Period rollup: start and end of the report differ → user didn't pick
        // "Por dia" in Meta. We reject the row to avoid attributing a whole
        // period's spend to a single date.
        const isPeriodRollup = !!endDate && endDate !== date

        const spend_cents = parseMoney(row[idxSpend] || '0')
        const impressions = idxImpressions >= 0 ? parseInt(row[idxImpressions] || '0', 10) || 0 : 0
        const clicks = idxClicks >= 0 ? parseInt(row[idxClicks] || '0', 10) || 0 : 0
        const matchedId = byName.get(campaignName.toLowerCase().trim())

        let warning: string | undefined
        if (isPeriodRollup) {
          warning = `Linha cobre ${date} → ${endDate}. Reexporte do Meta com "Detalhamento → Por dia".`
        } else if (!matchedId) {
          warning = `Campanha "${campaignName}" não está cadastrada`
        } else if (!date) {
          warning = `Data inválida: "${dateRaw}"`
        }

        return {
          rowNum: i + 2, // +1 for header, +1 for 1-based
          campaign_name: campaignName,
          date,
          spend_cents,
          impressions,
          clicks,
          matched: !!matchedId && !!date && !isPeriodRollup,
          campaign_id: matchedId,
          warning,
        }
      })

      setHeaders(hdrs)
      setParsed(out)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function confirm() {
    if (!parsed) return
    const valid = parsed.filter(p => p.matched && p.campaign_id)
    if (valid.length === 0) {
      toast.error('Nenhuma linha válida para importar')
      return
    }
    setImporting(true)
    const res = await bulkRecordCampaignMetrics(
      orgSlug,
      valid.map(p => ({
        campaign_id: p.campaign_id,
        date: p.date,
        impressions: p.impressions,
        clicks: p.clicks,
        spend_cents: p.spend_cents,
      })),
      'csv',
    )
    setImporting(false)
    if (res.ok) {
      toast.success(`${res.upserted} linha(s) importadas`)
      startTransition(() => router.push(`/app/${orgSlug}/marketing`))
    } else {
      toast.error(res.error)
    }
  }

  if (!parsed) {
    return (
      <Card>
        <CardContent className="p-8">
          <label className="block border-2 border-dashed border-border rounded-none p-12 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-1">Clique para enviar o arquivo CSV</p>
            <p className="text-xs text-muted-foreground">
              Formatos aceitos: export do Meta Ads Manager ou Google Ads
            </p>
          </label>

          <div className="mt-6 border-t pt-6 text-sm space-y-3">
            <p className="font-medium">Como exportar do Meta Ads Manager:</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Abra o Meta Ads Manager → aba "Campanhas"</li>
              <li>Selecione o período desejado</li>
              <li>
                <strong className="text-foreground">⚠ Crítico:</strong> clique em{' '}
                <strong className="text-foreground">"Detalhamento"</strong> (canto superior direito, ao lado de "Colunas") e
                selecione <strong className="text-foreground">"Por dia"</strong>. Sem isso, o Meta
                exporta um rollup sem coluna diária e o import não funciona.
              </li>
              <li>
                Clique no ícone de <strong className="text-foreground">download</strong> (seta pra baixo, à direita das
                colunas/detalhamento) → "Exportar dados da tabela" → CSV
              </li>
              <li>Envie o arquivo aqui</li>
            </ol>
            <p className="font-medium mt-3">Como exportar do Google Ads:</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Google Ads → aba "Campanhas"</li>
              <li>Selecione período</li>
              <li>Segmentar → "Dia" (botão segmentar no topo da tabela)</li>
              <li>Botão "Baixar" → CSV</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    )
  }

  const valid = parsed.filter(p => p.matched)
  const invalid = parsed.filter(p => !p.matched)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-5 h-5" /> Pré-visualização
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {parsed.length} linhas detectadas · {valid.length} prontas pra importar · {invalid.length}{' '}
          com problemas
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {invalid.length > 0 && (
          <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3 text-sm">
            <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300 mb-2">
              <AlertTriangle className="w-4 h-4" />
              {invalid.length} linha(s) serão puladas:
            </div>
            <ul className="text-xs space-y-1 max-h-32 overflow-y-auto">
              {invalid.slice(0, 10).map((p, i) => (
                <li key={i} className="text-amber-700 dark:text-amber-300">
                  Linha {p.rowNum}: {p.warning}
                </li>
              ))}
              {invalid.length > 10 && (
                <li className="text-amber-700 dark:text-amber-300">
                  ...e mais {invalid.length - 10} avisos
                </li>
              )}
            </ul>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
              Para resolver: cadastre as campanhas faltantes no CRM antes de importar.
            </p>
          </div>
        )}

        <div className="max-h-[400px] overflow-y-auto border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left px-2 py-1.5">#</th>
                <th className="text-left px-2 py-1.5">Campanha</th>
                <th className="text-left px-2 py-1.5">Data</th>
                <th className="text-right px-2 py-1.5">Gasto</th>
                <th className="text-right px-2 py-1.5">Impr.</th>
                <th className="text-right px-2 py-1.5">Cliques</th>
                <th className="text-left px-2 py-1.5">Status</th>
              </tr>
            </thead>
            <tbody>
              {parsed.map((p, i) => (
                <tr
                  key={i}
                  className={`border-t ${p.matched ? '' : 'bg-amber-50 dark:bg-amber-900/10'}`}
                >
                  <td className="px-2 py-1.5 text-muted-foreground">{p.rowNum}</td>
                  <td className="px-2 py-1.5">{p.campaign_name}</td>
                  <td className="px-2 py-1.5 font-mono">{p.date || '—'}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    R$ {(p.spend_cents / 100).toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {p.impressions}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {p.clicks}
                  </td>
                  <td className="px-2 py-1.5">
                    {p.matched ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> OK
                      </Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">
                        Pular
                      </Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => setParsed(null)}>
            Trocar arquivo
          </Button>
          <Button onClick={confirm} disabled={importing || valid.length === 0}>
            {importing ? 'Importando...' : `Importar ${valid.length} linha(s)`}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
