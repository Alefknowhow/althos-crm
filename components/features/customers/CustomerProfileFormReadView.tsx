'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Mail, Phone, Pencil, AtSign, ExternalLink } from 'lucide-react'
import type { ContatoContactPoint } from '@/actions/contatos'
import type { CustomerDoc } from '@/components/features/customers/CustomerDocuments'
import { DocumentsStrip } from './CustomerProfileFormDocumentsStrip'
import { formatPhoneDisplay } from '@/lib/utils'

type ReadForm = {
  name: string
  date_of_birth: string
  email: string
  phone: string
  instagram_username: string
  cpf: string
  rg: string
  passport_number: string
  passport_expiry: string
  has_us_visa: boolean
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  postal_code: string
  address_notes: string
}

export function CustomerProfileFormReadView({
  orgSlug,
  form,
  points,
  initialDocuments,
  onEdit,
  onManageDocs,
}: {
  orgSlug:          string
  form:              ReadForm
  points:            ContatoContactPoint[]
  initialDocuments:  CustomerDoc[]
  onEdit:            () => void
  onManageDocs:      () => void
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Nome completo', value: form.name || '—' },
    { label: 'Nascimento', value: form.date_of_birth || '—' },
    { label: 'E-mail', value: form.email || '—' },
    { label: 'Telefone', value: form.phone ? formatPhoneDisplay(form.phone) : '—' },
    { label: 'CPF', value: form.cpf || '—' },
    { label: 'RG', value: form.rg || '—' },
    { label: 'Nº do passaporte', value: form.passport_number || '—' },
    { label: 'Validade passaporte', value: form.passport_expiry || '—' },
    { label: 'Visto americano', value: form.has_us_visa ? 'Possui' : 'Não possui' },
    {
      label: 'Endereço',
      value: [form.street, form.number, form.complement, form.district, form.city, form.state, form.postal_code]
        .filter(Boolean).join(', ') || '—',
    },
    { label: 'Observações internas', value: form.address_notes || '—' },
  ]

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Cadastro do Cliente</CardTitle>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {rows.map(r => (
            <div key={r.label} className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{r.label}</div>
              <div className="text-sm truncate">{r.value}</div>
            </div>
          ))}
        </div>
        {form.instagram_username && (
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Instagram</div>
            <a
              href={`https://instagram.com/${form.instagram_username}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <AtSign className="w-3.5 h-3.5" /> {form.instagram_username} <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          </div>
        )}
        {points.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Outros contatos</div>
            {points.map(p => (
              <div key={p.id} className="flex items-center gap-2 text-sm">
                {p.kind === 'email' ? <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                {p.label && <span className="text-[10px] uppercase tracking-wide text-muted-foreground shrink-0">{p.label}</span>}
                <span className="truncate">{p.kind === 'phone' ? formatPhoneDisplay(p.value) : p.value}</span>
              </div>
            ))}
          </div>
        )}
        <div className="pt-2 border-t space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Documentos</div>
          <DocumentsStrip orgSlug={orgSlug} documents={initialDocuments} onManage={onManageDocs} />
        </div>
      </CardContent>
    </Card>
  )
}
