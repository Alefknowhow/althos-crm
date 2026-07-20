'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Upload, FileText, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { parseCsv, parseMoney, parseDate, detectColumn } from '@/lib/csv'
import { bulkCreateFinancialEntries } from '@/actions/financial'

const HEADER_SYNONYMS = {
  date: ['data', 'date', 'dia', 'data lancamento', 'data lançamento'],
  descricao: ['descricao', 'descrição', 'description', 'historico', 'histórico', 'lancamento', 'lançamento'],
  valor: ['valor', 'value', 'amount', 'valor (r$)', 'montante'],
} as const

type ParsedRow = {
  rowNum: number
  descricao: string
  competencia: string
  valor_cents: number
  tipo: 'receita' | 'despesa'
  matched: boolean
  warning?: string
}

export default function FinancialCsvImporter({
  orgSlug,
  open,
  onOpenChange,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null)
  const [importing, setImporting] = useState(false)

  function reset() {
    setParsed(null)
  }

  function handleFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const text = String(e.target?.result || '')
      const { headers, rows } = parseCsv(text)

      if (rows.length === 0) {
        toast.error('CSV vazio ou inválido')
        return
      }

      const idxDate = detectColumn(headers, HEADER_SYNONYMS.date)
      const idxDescricao = detectColumn(headers, HEADER_SYNONYMS.descricao)
      const idxValor = detectColumn(headers, HEADER_SYNONYMS.valor)

      const missing: string[] = []
      if (idxDate < 0) missing.push('Data')
      if (idxValor < 0) missing.push('Valor')
      if (missing.length > 0) {
        toast.error(`Não consegui identificar: ${missing.join(', ')}. Colunas encontradas: ${headers.join(', ')}`, { duration: 10000 })
        return
      }

      const out: ParsedRow[] = rows.map((row, i) => {
        const dateRaw = row[idxDate] || ''
        const competencia = parseDate(dateRaw) || ''
        const descricao = idxDescricao >= 0 ? (row[idxDescricao] || '').trim() : ''
        const rawValor = row[idxValor] || '0'
        const valorCents = parseMoney(rawValor)
        const tipo: 'receita' | 'despesa' = rawValor.trim().startsWith('-') ? 'despesa' : 'receita'

        let warning: string | undefined
        if (!competencia) warning = `Data inválida: "${dateRaw}"`
        else if (valorCents === 0) warning = 'Valor zerado ou inválido'

        return {
          rowNum: i + 2,
          descricao,
          competencia,
          valor_cents: Math.abs(valorCents),
          tipo,
          matched: !!competencia && valorCents !== 0,
          warning,
        }
      })

      setParsed(out)
    }
    reader.readAsText(file, 'utf-8')
  }

  async function confirm() {
    if (!parsed) return
    const valid = parsed.filter(p => p.matched)
    if (valid.length === 0) { toast.error('Nenhuma linha válida para importar'); return }

    setImporting(true)
    const res = await bulkCreateFinancialEntries(
      orgSlug,
      valid.map(p => ({
        tipo: p.tipo,
        categoria: 'A categorizar',
        valor_cents: p.valor_cents,
        competencia: p.competencia,
        observacoes: p.descricao || null,
      })),
    )
    setImporting(false)

    if (res.ok) {
      toast.success(`${res.count} lançamento(s) importado(s). Revise a categoria de cada um em Lançamentos.`)
      reset()
      onOpenChange(false)
      router.refresh()
    } else {
      toast.error(res.error)
    }
  }

  const valid = parsed?.filter(p => p.matched) ?? []
  const invalid = parsed?.filter(p => !p.matched) ?? []

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Upload className="w-4 h-4 text-primary" /> Importar extrato (CSV)</DialogTitle>
          <DialogDescription>
            Envie um CSV com colunas de data, descrição e valor. Valores negativos viram despesa, positivos viram receita.
            Os lançamentos entram com a categoria "A categorizar" — revise depois em Lançamentos.
          </DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <Card>
            <CardContent className="p-8">
              <label className="block border-2 border-dashed border-border rounded-none p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium mb-1">Clique para enviar o arquivo CSV</p>
                <p className="text-xs text-muted-foreground">Extrato bancário exportado como CSV</p>
              </label>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><FileText className="w-4 h-4" /> Pré-visualização</CardTitle>
              <p className="text-xs text-muted-foreground">
                {parsed.length} linhas detectadas · {valid.length} prontas pra importar · {invalid.length} com problemas
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {invalid.length > 0 && (
                <div className="border border-amber-300 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300 mb-2">
                    <AlertTriangle className="w-4 h-4" /> {invalid.length} linha(s) serão puladas:
                  </div>
                  <ul className="text-xs space-y-1 max-h-28 overflow-y-auto">
                    {invalid.slice(0, 10).map((p, i) => (
                      <li key={i} className="text-amber-700 dark:text-amber-300">Linha {p.rowNum}: {p.warning}</li>
                    ))}
                    {invalid.length > 10 && <li className="text-amber-700 dark:text-amber-300">...e mais {invalid.length - 10} avisos</li>}
                  </ul>
                </div>
              )}

              <div className="max-h-[320px] overflow-y-auto border rounded-md">
                <table className="w-full text-xs">
                  <thead className="bg-muted text-muted-foreground sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5">#</th>
                      <th className="text-left px-2 py-1.5">Descrição</th>
                      <th className="text-left px-2 py-1.5">Data</th>
                      <th className="text-left px-2 py-1.5">Tipo</th>
                      <th className="text-right px-2 py-1.5">Valor</th>
                      <th className="text-left px-2 py-1.5">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, i) => (
                      <tr key={i} className={`border-t ${p.matched ? '' : 'bg-amber-50 dark:bg-amber-900/10'}`}>
                        <td className="px-2 py-1.5 text-muted-foreground">{p.rowNum}</td>
                        <td className="px-2 py-1.5 truncate max-w-[220px]">{p.descricao || '—'}</td>
                        <td className="px-2 py-1.5 font-mono">{p.competencia || '—'}</td>
                        <td className="px-2 py-1.5">{p.tipo === 'receita' ? 'Receita' : 'Despesa'}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums">R$ {(p.valor_cents / 100).toFixed(2)}</td>
                        <td className="px-2 py-1.5">
                          {p.matched ? (
                            <Badge className="bg-green-100 text-green-700 border-green-200 text-[10px]"><CheckCircle2 className="w-2.5 h-2.5 mr-1" /> OK</Badge>
                          ) : (
                            <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px]">Pular</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={reset}>Trocar arquivo</Button>
                <Button onClick={confirm} disabled={importing || valid.length === 0}>
                  {importing ? 'Importando...' : `Importar ${valid.length} lançamento(s)`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  )
}
