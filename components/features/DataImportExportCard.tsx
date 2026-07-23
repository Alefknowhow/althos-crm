'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card'
import { toast } from 'sonner'
import { Download, Upload, Loader2, FileDown } from 'lucide-react'
import { parseCsv, detectColumn } from '@/lib/csv'
import {
  exportContatosCsv, exportTravelSalesCsv, bulkImportContatos, bulkImportTravelSales,
  type ImportContatoRow, type ImportSaleRow,
} from '@/actions/data-import-export'

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  URL.revokeObjectURL(url)
}

const CONTATOS_TEMPLATE = [
  'nome,email,telefone,status,origem,tags',
  'Maria Silva,maria@email.com,11999998888,lead,Instagram,vip|indicacao',
  'João Souza,,11988887777,cliente,Site,',
].join('\r\n')

const RESERVAS_TEMPLATE = [
  'cliente_nome,cliente_telefone,cliente_email,destino,data_ida,data_volta,hotel,companhia_aerea,operadora,valor_total,comissao,status,observacoes',
  'Maria Silva,11999998888,maria@email.com,Punta Cana,15/03/2026,22/03/2026,Riu Palace,Copa Airlines,CVC,15000.00,1200.00,open,Pacote all inclusive',
].join('\r\n')

function CsvBlock({
  title, description, onExport, onImport, template, templateName, importing,
}: {
  title: string
  description: string
  onExport: () => void
  onImport: (file: File) => void
  template: string
  templateName: string
  importing: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div>
        <h3 className="font-medium text-sm">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onExport} className="gap-1.5">
          <Download className="w-3.5 h-3.5" /> Exportar CSV
        </Button>
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={importing} className="gap-1.5">
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Importar CSV
        </Button>
        <Button variant="ghost" size="sm" onClick={() => downloadText(templateName, template)} className="gap-1.5 text-muted-foreground">
          <FileDown className="w-3.5 h-3.5" /> Baixar modelo
        </Button>
        <input ref={inputRef} type="file" accept=".csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onImport(f); e.target.value = '' }} />
      </div>
    </div>
  )
}

export default function DataImportExportCard({ orgSlug }: { orgSlug: string }) {
  const [importingContatos, setImportingContatos] = useState(false)
  const [importingReservas, setImportingReservas] = useState(false)

  async function handleExport(fn: () => Promise<string>, filename: string) {
    const csv = await fn()
    downloadText(filename, csv)
  }

  async function handleImportContatos(file: File) {
    setImportingContatos(true)
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    const iNome = detectColumn(headers, ['nome', 'name'])
    const iEmail = detectColumn(headers, ['email', 'e-mail'])
    const iTelefone = detectColumn(headers, ['telefone', 'phone', 'celular'])
    const iStatus = detectColumn(headers, ['status'])
    const iOrigem = detectColumn(headers, ['origem', 'source'])
    const iTags = detectColumn(headers, ['tags'])

    const parsed: ImportContatoRow[] = rows.map(r => ({
      nome: r[iNome] || '',
      email: iEmail >= 0 ? r[iEmail] : undefined,
      telefone: iTelefone >= 0 ? r[iTelefone] : undefined,
      status: iStatus >= 0 ? r[iStatus] : undefined,
      origem: iOrigem >= 0 ? r[iOrigem] : undefined,
      tags: iTags >= 0 ? r[iTags] : undefined,
    }))
    const res = await bulkImportContatos(orgSlug, parsed)
    setImportingContatos(false)
    if (!res.ok) { toast.error(res.error); return }
    toast[res.errors.length ? 'warning' : 'success'](
      `${res.imported} contato(s) importado(s)${res.errors.length ? `, ${res.errors.length} erro(s)` : ''}.`,
    )
    if (res.errors.length) console.warn('Erros na importação de contatos:', res.errors)
  }

  async function handleImportReservas(file: File) {
    setImportingReservas(true)
    const text = await file.text()
    const { headers, rows } = parseCsv(text)
    const idx = (keys: string[]) => detectColumn(headers, keys)
    const cols = {
      cliente_nome: idx(['cliente_nome', 'nome']),
      cliente_telefone: idx(['cliente_telefone', 'telefone']),
      cliente_email: idx(['cliente_email', 'email']),
      destino: idx(['destino']),
      data_ida: idx(['data_ida']),
      data_volta: idx(['data_volta']),
      hotel: idx(['hotel']),
      companhia_aerea: idx(['companhia_aerea', 'cia_aerea', 'airline']),
      operadora: idx(['operadora']),
      valor_total: idx(['valor_total', 'total']),
      comissao: idx(['comissao', 'comissão']),
      status: idx(['status']),
      observacoes: idx(['observacoes', 'observações', 'notas']),
    }
    const parsed: ImportSaleRow[] = rows.map(r => Object.fromEntries(
      Object.entries(cols).map(([key, i]) => [key, i >= 0 ? r[i] : undefined]),
    ) as ImportSaleRow)
    const res = await bulkImportTravelSales(orgSlug, parsed)
    setImportingReservas(false)
    if (!res.ok) { toast.error(res.error); return }
    toast[res.errors.length ? 'warning' : 'success'](
      `${res.imported} reserva(s)/venda(s) importada(s)${res.errors.length ? `, ${res.errors.length} erro(s)` : ''}.`,
    )
    if (res.errors.length) console.warn('Erros na importação de reservas/vendas:', res.errors)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Importação / Exportação de dados</CardTitle>
        <CardDescription>Exporte seus dados ou importe em lote a partir de uma planilha CSV.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <CsvBlock
          title="Contatos"
          description="Leads e clientes cadastrados."
          onExport={() => handleExport(() => exportContatosCsv(orgSlug), 'contatos.csv')}
          onImport={handleImportContatos}
          template={CONTATOS_TEMPLATE}
          templateName="modelo-contatos.csv"
          importing={importingContatos}
        />
        <CsvBlock
          title="Reservas / Vendas"
          description="Vendas de viagem — o cliente é localizado pelo telefone/e-mail ou criado automaticamente se não existir."
          onExport={() => handleExport(() => exportTravelSalesCsv(orgSlug), 'reservas-vendas.csv')}
          onImport={handleImportReservas}
          template={RESERVAS_TEMPLATE}
          templateName="modelo-reservas-vendas.csv"
          importing={importingReservas}
        />
      </CardContent>
    </Card>
  )
}
