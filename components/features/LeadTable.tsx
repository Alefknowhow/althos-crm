import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'

export default function LeadTable({ leads, orgSlug }: { leads: any[], orgSlug: string }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>Contato</TableHead>
          <TableHead>Estágio</TableHead>
          <TableHead>Tags</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Criado em</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {leads.map(lead => (
          <TableRow key={lead.id} className="cursor-pointer">
            <TableCell>
              <Link href={`/app/${orgSlug}/contatos/${lead.id}`} className="block font-medium hover:underline">
                {lead.name}
              </Link>
            </TableCell>
            <TableCell>
              <div className="text-sm">{lead.email || '-'}</div>
              <div className="text-xs text-muted-foreground">{lead.phone || '-'}</div>
            </TableCell>
            <TableCell><Badge>{lead.pipeline_stages?.name || 'Sem estágio'}</Badge></TableCell>
            <TableCell>
              <div className="flex gap-1 flex-wrap">
                {lead.tags?.map((t: string) => <Badge key={t} variant="outline">{t}</Badge>)}
              </div>
            </TableCell>
            <TableCell>{lead.value_cents ? `R$ ${(lead.value_cents / 100).toFixed(2)}` : '-'}</TableCell>
            <TableCell className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString('pt-BR')}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
