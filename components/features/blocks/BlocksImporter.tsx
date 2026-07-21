'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { parseCsv, detectColumn, parseDate } from '@/lib/csv'
import { bulkCreateTravelBlocks } from '@/actions/travel-blocks'
import { toast } from 'sonner'
import { Upload, Loader2, FileSpreadsheet } from 'lucide-react'

type ParsedRow = {
  origem: string
  destino: string
  data_ida: string | null
  data_volta: string | null
  voo_ida: string | null
  horario_ida: string | null
  voo_volta: string | null
  horario_volta: string | null
  assentos_disponiveis: number
  prazo: string | null
  valid: boolean
  issue?: string
}

/**
 * Mapeia a matriz (headers + linhas) da planilha do mapa de bloqueios pros
 * campos do travel_block. Colunas esperadas (com variações): OD, ORIGEM,
 * DESTINO, MÊS (ignorada — derivada da data), DATA IDA, DATA VOLTA, VOO IDA,
 * HORARIO IDA, VOO VOLTA, HORARIO VOLTA, ASSENTOS DISPONÍVEIS, PRAZO.
 */
function mapMatrix(headers: string[], rows: string[][]): ParsedRow[] {
  const col = {
    od: detectColumn(headers, ['od', 'trecho']),
    origem: detectColumn(headers, ['origem']),
    destino: detectColumn(headers, ['destino']),
    dataIda: detectColumn(headers, ['data ida', 'data de ida', 'ida']),
    dataVolta: detectColumn(headers, ['data volta', 'data de volta', 'volta']),
    vooIda: detectColumn(headers, ['voo ida', 'voo da ida']),
    horarioIda: detectColumn(headers, ['horario ida', 'horario da', 'horario da ida', 'horário ida', 'horário da']),
    vooVolta: detectColumn(headers, ['voo volta', 'voo da volta']),
    horarioVolta: detectColumn(headers, ['horario volta', 'horario da volta', 'horário volta']),
    assentos: detectColumn(headers, ['assentos disponiveis', 'assentos disponíveis', 'assentos', 'disponiveis', 'lugares']),
    prazo: detectColumn(headers, ['prazo', 'release']),
  }

  const get = (row: string[], idx: number) => (idx >= 0 ? (row[idx] || '').trim() : '')

  return rows
    // Ignora linhas totalmente vazias (a planilha tem linhas em branco de separação).
    .filter(row => row.some(cell => cell && cell.trim()))
    .map(row => {
      let origem = get(row, col.origem).toUpperCase()
      let destino = get(row, col.destino).toUpperCase()
      // Sem colunas ORIGEM/DESTINO, deriva do OD (ex.: "GYNFOR" → GYN + FOR).
      const od = get(row, col.od).toUpperCase().replace(/[^A-Z]/g, '')
      if ((!origem || !destino) && od.length === 6) {
        origem = origem || od.slice(0, 3)
        destino = destino || od.slice(3)
      }

      const data_ida = parseDate(get(row, col.dataIda))
      const assentosRaw = get(row, col.assentos)
      const assentos = parseInt(assentosRaw.replace(/\D/g, ''), 10)

      const parsed: ParsedRow = {
        origem, destino, data_ida,
        data_volta: parseDate(get(row, col.dataVolta)),
        voo_ida: get(row, col.vooIda) || null,
        horario_ida: get(row, col.horarioIda) || null,
        voo_volta: get(row, col.vooVolta) || null,
        horario_volta: get(row, col.horarioVolta) || null,
        assentos_disponiveis: Number.isFinite(assentos) ? assentos : 0,
        prazo: parseDate(get(row, col.prazo)),
        valid: true,
      }

      if (!origem || !destino) { parsed.valid = false; parsed.issue = 'Sem origem/destino' }
      else if (!data_ida) { parsed.valid = false; parsed.issue = 'Data de ida inválida' }
      return parsed
    })
}

function fmtDate(d: string | null) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—' }

export default function BlocksImporter({
  orgSlug, open, onOpenChange,
}: {
  orgSlug: string
  open: boolean
  onOpenChange: (o: boolean) => void
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [parsing, setParsing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [rows, setRows] = useState<ParsedRow[]>([])

  function reset() {
    setFileName(null); setRows([]); setParsing(false); setImporting(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFile(f: File) {
    setParsing(true)
    setFileName(f.name)
    try {
      let headers: string[]
      let matrix: string[][]
      if (/\.(xlsx|xlsm|xls)$/i.test(f.name)) {
        // SheetJS só é carregado quando o usuário realmente importa uma planilha Excel.
        const XLSX = await import('xlsx')
        const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true })
        const sheet = wb.Sheets[wb.SheetNames[0]]
        const aoa = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, raw: false, dateNF: 'dd/mm/yyyy' })
        const nonEmpty = aoa.filter(r => Array.isArray(r) && r.some(c => String(c ?? '').trim()))
        headers = (nonEmpty[0] || []).map(c => String(c ?? ''))
        matrix = nonEmpty.slice(1).map(r => r.map(c => String(c ?? '')))
      } else {
        const parsed = parseCsv(await f.text())
        headers = parsed.headers
        matrix = parsed.rows
      }
      const mapped = mapMatrix(headers, matrix)
      if (mapped.length === 0) toast.error('Nenhuma linha encontrada na planilha.')
      setRows(mapped)
    } catch (e: any) {
      toast.error(e?.message || 'Não foi possível ler o arquivo.')
      reset()
    }
    setParsing(false)
  }

  async function handleImport() {
    const valid = rows.filter(r => r.valid)
    if (valid.length === 0) { toast.error('Nenhuma linha válida para importar.'); return }
    setImporting(true)
    const res = await bulkCreateTravelBlocks(orgSlug, valid.map(({ valid: _v, issue: _i, ...rest }) => rest))
    setImporting(false)
    if (!res.ok) { toast.error(res.error); return }
    toast.success(`${res.count} bloqueio(s) importado(s)`)
    reset()
    onOpenChange(false)
    router.refresh()
  }

  const validCount = rows.filter(r => r.valid).length

  return (
    <Dialog open={open} onOpenChange={o => { onOpenChange(o); if (!o) reset() }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" /> Importar bloqueios
          </DialogTitle>
          <DialogDescription>
            Envie a planilha do mapa de bloqueios (CSV, XLSX ou XLSM) com as colunas OD/Origem/Destino,
            datas, voos, horários, assentos disponíveis e prazo. Linhas em branco são ignoradas.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <label className="block border-2 border-dashed border-border rounded-none p-10 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.xlsx,.xlsm,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
            {parsing ? (
              <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Lendo a planilha…
              </span>
            ) : (
              <>
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium mb-1">Clique para enviar a planilha</p>
                <p className="text-xs text-muted-foreground">CSV, XLSX ou XLSM</p>
              </>
            )}
          </label>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{fileName}</span> — {validCount} de {rows.length} linha(s) válida(s).
              {validCount < rows.length && ' Linhas com problema (em vermelho) não serão importadas.'}
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-none border">
              <table className="w-full text-xs min-w-[760px]">
                <thead className="sticky top-0 bg-muted">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-1.5 font-semibold">OD</th>
                    <th className="px-2 py-1.5 font-semibold">Ida</th>
                    <th className="px-2 py-1.5 font-semibold">Volta</th>
                    <th className="px-2 py-1.5 font-semibold">Voo ida</th>
                    <th className="px-2 py-1.5 font-semibold">Hor. ida</th>
                    <th className="px-2 py-1.5 font-semibold">Voo volta</th>
                    <th className="px-2 py-1.5 font-semibold">Hor. volta</th>
                    <th className="px-2 py-1.5 font-semibold text-center">Assentos</th>
                    <th className="px-2 py-1.5 font-semibold">Prazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r, i) => (
                    <tr key={i} className={r.valid ? '' : 'bg-destructive/10 text-destructive'} title={r.issue}>
                      <td className="px-2 py-1.5 font-semibold whitespace-nowrap">{r.origem}{r.destino}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(r.data_ida)}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(r.data_volta)}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.voo_ida || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.horario_ida || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.voo_volta || '—'}</td>
                      <td className="px-2 py-1.5 whitespace-nowrap">{r.horario_volta || '—'}</td>
                      <td className="px-2 py-1.5 text-center tabular-nums">{r.assentos_disponiveis}</td>
                      <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(r.prazo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" disabled={importing} onClick={() => onOpenChange(false)}>Cancelar</Button>
          {rows.length > 0 && (
            <>
              <Button variant="outline" disabled={importing} onClick={reset}>Trocar arquivo</Button>
              <Button disabled={importing || validCount === 0} onClick={handleImport}>
                {importing
                  ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importando…</>
                  : `Importar ${validCount} bloqueio(s)`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
