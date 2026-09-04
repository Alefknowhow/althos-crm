'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { bulkRecordCampaignMetrics } from '@/actions/marketing'
import { parseCampaignCsv, type ParsedRow } from './CsvImporterParse'

type Campaign = { id: string; name: string }

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
  const [, setHeaders] = useState<string[]>([])
  const [importing, setImporting] = useState(false)

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = String(e.target?.result || '')
      const result = parseCampaignCsv(text, campaigns)
      if (!result.ok) {
        toast.error(result.error, { duration: 12000 })
        console.warn('CSV column detection failed:', result.error)
        return
      }
      setHeaders(result.headers)
      setParsed(result.rows)
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
              <li>Abra o Meta Ads Manager → aba &quot;Campanhas&quot;</li>
              <li>Selecione o período desejado</li>
              <li>
                <strong className="text-foreground">⚠ Crítico:</strong> clique em{' '}
                <strong className="text-foreground">&quot;Detalhamento&quot;</strong> (canto superior direito, ao lado de &quot;Colunas&quot;) e
                selecione <strong className="text-foreground">&quot;Por dia&quot;</strong>. Sem isso, o Meta
                exporta um rollup sem coluna diária e o import não funciona.
              </li>
              <li>
                Clique no ícone de <strong className="text-foreground">download</strong> (seta pra baixo, à direita das
                colunas/detalhamento) → &quot;Exportar dados da tabela&quot; → CSV
              </li>
              <li>Envie o arquivo aqui</li>
            </ol>
            <p className="font-medium mt-3">Como exportar do Google Ads:</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-1">
              <li>Google Ads → aba &quot;Campanhas&quot;</li>
              <li>Selecione período</li>
              <li>Segmentar → &quot;Dia&quot; (botão segmentar no topo da tabela)</li>
              <li>Botão &quot;Baixar&quot; → CSV</li>
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
