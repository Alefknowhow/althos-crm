import { requireAuth, getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import FormListActions from '@/components/features/FormListActions'
import NewFormButton from '@/components/features/NewFormButton'
import { FileEdit, BarChart2 } from 'lucide-react'

export default async function FormsPage({ params }: { params: { orgSlug: string } }) {
  await requireAuth()
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: forms } = await supabase
    .from('forms')
    .select('id, name, slug, is_active, created_at, form_submissions(count)')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Formulários</h1>
        <NewFormButton orgSlug={params.orgSlug} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden">
        {forms && forms.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right pr-4">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forms.map(form => {
                const submissionCount = (form.form_submissions as any)?.[0]?.count ?? 0
                return (
                  <TableRow key={form.id}>
                    <TableCell>
                      <Link
                        href={`/app/${params.orgSlug}/forms/${form.id}/edit`}
                        className="font-medium hover:underline block"
                      >
                        {form.name}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5 font-mono">/f/{form.slug}</div>
                    </TableCell>
                    <TableCell>
                      {form.is_active ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Pausado</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(form.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs">
                          <Link href={`/app/${params.orgSlug}/forms/${form.id}/edit`}>
                            <FileEdit className="w-3.5 h-3.5" />
                            Editar
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="h-8 gap-1.5 text-xs">
                          <Link href={`/app/${params.orgSlug}/forms/${form.id}/respostas`}>
                            <BarChart2 className="w-3.5 h-3.5" />
                            {submissionCount > 0 ? `${submissionCount} respostas` : 'Respostas'}
                          </Link>
                        </Button>
                        <FormListActions orgSlug={params.orgSlug} form={form} />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground bg-muted/10">
            Nenhum formulário criado. Comece criando o seu primeiro para captar leads.
          </div>
        )}
      </div>
    </div>
  )
}
