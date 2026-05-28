'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { triggerCsvImport } from '@/actions/import'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FileUp, Loader2, Check } from 'lucide-react'

export default function ImportLeadsPage({ params }: { params: { orgSlug: string } }) {
  const [file, setFile] = useState<File | null>(null)
  const [data, setData] = useState<any[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState({ name: '', email: '', phone: '' })
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFile(file)

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim()))
      if (rows.length > 0) {
        setHeaders(rows[0])
        setData(rows.slice(1).filter(r => r.length > 1))
        setStep(2)
      }
    }
    reader.readAsText(file)
  }

  const handleImport = async () => {
    if (!mapping.name) {
      toast.error('O campo Nome é obrigatório para o mapeamento.')
      return
    }

    setLoading(true)
    try {
      await triggerCsvImport(params.orgSlug, data, mapping)
      toast.success('Importação iniciada em segundo plano! Você receberá uma notificação em breve.')
      router.push(`/app/${params.orgSlug}/leads`)
    } catch (error) {
      toast.error('Erro ao iniciar importação')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Importar Leads</h1>
        <p className="text-muted-foreground">Siga os passos abaixo para importar seus contatos.</p>
      </div>

      {step === 1 && (
        <Card className="border-dashed border-2 py-12 flex flex-col items-center justify-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FileUp className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h3 className="font-semibold">Selecione seu arquivo CSV</h3>
            <p className="text-sm text-muted-foreground">O arquivo deve estar separado por vírgulas.</p>
          </div>
          <Input 
            type="file" 
            accept=".csv" 
            className="max-w-xs cursor-pointer"
            onChange={handleFileChange}
          />
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de Campos</CardTitle>
              <CardDescription>Associe as colunas do seu arquivo aos campos do Lead no Althos.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label>Nome (Obrigatório)</Label>
                <Select onValueChange={(v) => setMapping({ ...mapping, name: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Select onValueChange={(v) => setMapping({ ...mapping, email: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Select onValueChange={(v) => setMapping({ ...mapping, phone: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher coluna..." />
                  </SelectTrigger>
                  <SelectContent>
                    {headers.map((h, i) => (
                      <SelectItem key={i} value={i.toString()}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preview (Primeiras 5 linhas)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h, i) => (
                        <TableHead key={i}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.slice(0, 5).map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell: any, j: number) => (
                          <TableCell key={j}>{cell}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>Voltar</Button>
              <Button onClick={handleImport} disabled={loading || !mapping.name}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                Importar {data.length} leads
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  )
}
