import { getCurrentOrganization } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import NewTemplateButton from '@/components/features/email/NewTemplateButton'
import CopyIdButton from '@/components/features/email/CopyIdButton'
import DeleteTemplateButton from '@/components/features/email/DeleteTemplateButton'
import { TEMPLATE_CATEGORIES } from '@/lib/email/template-seeds'

const CATEGORY_LABEL = new Map(TEMPLATE_CATEGORIES.map(c => [c.id, c.label]))

export default async function EmailTemplatesPage({ params }: { params: { orgSlug: string } }) {
  const org = await getCurrentOrganization(params.orgSlug)
  const supabase = createClient()

  const { data: templates } = await supabase
    .from('email_templates')
    .select('id, name, subject, category, created_at')
    .eq('organization_id', org.id)
    .order('created_at', { ascending: false })

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Templates de E-mail</h1>
        <NewTemplateButton orgSlug={params.orgSlug} />
      </div>

      <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
        {templates && templates.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Interno</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>ID (automações)</TableHead>
                <TableHead>Última Edição</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map(t => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    {t.category ? (
                      <Badge variant="secondary" className="text-xs">
                        {CATEGORY_LABEL.get(t.category as any) || t.category}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{t.subject || '(sem assunto)'}</TableCell>
                  <TableCell><CopyIdButton id={t.id} /></TableCell>
                  <TableCell className="text-muted-foreground">{new Date(t.created_at).toLocaleDateString('pt-BR')}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link href={`/app/${params.orgSlug}/email-templates/${t.id}/edit`}>
                        <Button variant="ghost" size="sm">Editar</Button>
                      </Link>
                      <DeleteTemplateButton orgSlug={params.orgSlug} templateId={t.id} templateName={t.name} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-12 text-center text-muted-foreground bg-muted/10 border-dashed border-2 m-4 rounded-lg">Nenhum template de e-mail criado.</div>
        )}
      </div>
    </div>
  )
}
