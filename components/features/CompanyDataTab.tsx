'use client'

/**
 * CompanyDataTab — editable business data (CNPJ, CADASTUR, contacts, address).
 * These fields are rendered in the header/footer of generated travel proposals.
 */

import { useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateOrgCompany, type OrgCompanyData } from '@/actions/organization'
import { toast } from 'sonner'
import { Loader2, Building2 } from 'lucide-react'

const FIELDS: { key: keyof OrgCompanyData; label: string; placeholder?: string; type?: string }[] = [
  { key: 'cnpj',           label: 'CNPJ',              placeholder: '00.000.000/0000-00' },
  { key: 'cadastur',       label: 'CADASTUR',          placeholder: 'Nº do CADASTUR' },
  { key: 'contact_phone',  label: 'Telefone',          placeholder: '(11) 99999-9999' },
  { key: 'contact_email',  label: 'E-mail comercial',  placeholder: 'contato@empresa.com', type: 'email' },
  { key: 'instagram',      label: 'Instagram',         placeholder: '@suaempresa' },
  { key: 'website',        label: 'Site',              placeholder: 'https://www.empresa.com' },
  { key: 'address_street', label: 'Endereço',          placeholder: 'Rua, número, bairro' },
  { key: 'address_city',   label: 'Cidade',            placeholder: 'São Paulo' },
  { key: 'address_state',  label: 'Estado (UF)',       placeholder: 'SP' },
  { key: 'address_zip',    label: 'CEP',               placeholder: '00000-000' },
]

export default function CompanyDataTab({
  orgSlug,
  initial,
}: {
  orgSlug: string
  initial: OrgCompanyData
}) {
  const [values, setValues] = useState<OrgCompanyData>(initial)
  const [pending, start] = useTransition()

  const dirty = FIELDS.some(f => (values[f.key] ?? '') !== (initial[f.key] ?? ''))

  function set(key: keyof OrgCompanyData, v: string) {
    setValues(prev => ({ ...prev, [key]: v }))
  }

  function save() {
    start(async () => {
      const res = await updateOrgCompany(orgSlug, values)
      if (res.ok) toast.success('Dados da empresa salvos!')
      else toast.error(res.error || 'Não foi possível salvar.')
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-primary" /> Dados da Empresa
        </CardTitle>
        <CardDescription>
          Essas informações aparecem no cabeçalho e no rodapé das propostas geradas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FIELDS.map(f => (
            <div key={f.key} className="space-y-2">
              <Label>{f.label}</Label>
              <Input
                type={f.type || 'text'}
                value={values[f.key] ?? ''}
                placeholder={f.placeholder}
                onChange={e => set(f.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={save} disabled={!dirty || pending}>
          {pending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Salvar Dados
        </Button>
      </CardFooter>
    </Card>
  )
}
