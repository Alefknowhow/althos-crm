'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Search, Save, Loader2 } from 'lucide-react'
import { upsertCustomerProfile } from '@/actions/contatos'

type Profile = {
  cpf: string | null
  rg: string | null
  passport_number: string | null
  passport_expiry: string | null
  has_us_visa: boolean | null
  date_of_birth: string | null
  postal_code: string | null
  street: string | null
  number: string | null
  complement: string | null
  district: string | null
  city: string | null
  state: string | null
  country: string | null
  address_notes: string | null
} | null

function maskCpf(v: string): string {
  // 000.000.000-00
  const d = v.replace(/\D/g, '').slice(0, 11)
  let out = d
  if (d.length > 9) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
  else if (d.length > 6) out = `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  else if (d.length > 3) out = `${d.slice(0, 3)}.${d.slice(3)}`
  return out
}

function maskCep(v: string): string {
  // 00000-000
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

export default function CustomerProfileForm({
  orgSlug,
  leadId,
  initial,
}: {
  orgSlug: string
  leadId: string
  initial: Profile
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [cepLoading, setCepLoading] = useState(false)

  const [form, setForm] = useState({
    cpf: initial?.cpf || '',
    rg: initial?.rg || '',
    passport_number: initial?.passport_number || '',
    passport_expiry: initial?.passport_expiry || '',
    has_us_visa: initial?.has_us_visa ?? false,
    date_of_birth: initial?.date_of_birth || '',
    postal_code: initial?.postal_code || '',
    street: initial?.street || '',
    number: initial?.number || '',
    complement: initial?.complement || '',
    district: initial?.district || '',
    city: initial?.city || '',
    state: initial?.state || '',
    country: initial?.country || 'BR',
    address_notes: initial?.address_notes || '',
  })

  /**
   * ViaCEP free public API — given a CEP (digits only), fills street, district,
   * city, state. Fails silently so the operator can still type by hand if
   * the service is down.
   */
  async function lookupCep() {
    const digits = form.postal_code.replace(/\D/g, '')
    if (digits.length !== 8) {
      toast.error('CEP precisa ter 8 dígitos')
      return
    }
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`)
      const data = await res.json()
      if (data.erro) {
        toast.error('CEP não encontrado')
        return
      }
      setForm(f => ({
        ...f,
        street: data.logradouro || f.street,
        district: data.bairro || f.district,
        city: data.localidade || f.city,
        state: data.uf || f.state,
      }))
      toast.success('Endereço preenchido')
    } catch (e: any) {
      toast.error('Falha ao consultar CEP')
    } finally {
      setCepLoading(false)
    }
  }

  async function save() {
    setSaving(true)
    const res = await upsertCustomerProfile(orgSlug, leadId, form)
    setSaving(false)
    if (res.ok) {
      toast.success('Dados do cliente salvos')
      startTransition(() => router.refresh())
    } else {
      toast.error((res as any).error || 'Erro ao salvar')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Cadastro do Cliente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Documentos */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Documentos
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">CPF</Label>
              <Input
                value={form.cpf}
                onChange={e => setForm({ ...form, cpf: maskCpf(e.target.value) })}
                placeholder="000.000.000-00"
                inputMode="numeric"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">RG</Label>
              <Input
                value={form.rg}
                onChange={e => setForm({ ...form, rg: e.target.value })}
                placeholder="00.000.000-0"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de nascimento</Label>
              <Input
                type="date"
                value={form.date_of_birth}
                onChange={e => setForm({ ...form, date_of_birth: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Passaporte e Visto */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Passaporte e Visto
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Número do passaporte</Label>
              <Input
                value={form.passport_number}
                onChange={e => setForm({ ...form, passport_number: e.target.value.toUpperCase() })}
                placeholder="AB123456"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Validade do passaporte</Label>
              <Input
                type="date"
                value={form.passport_expiry}
                onChange={e => setForm({ ...form, passport_expiry: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Visto americano</Label>
              <label className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background cursor-pointer">
                <input
                  type="checkbox"
                  className="accent-primary w-4 h-4"
                  checked={form.has_us_visa}
                  onChange={e => setForm({ ...form, has_us_visa: e.target.checked })}
                />
                <span className="text-sm">{form.has_us_visa ? 'Possui' : 'Não possui'}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Endereço */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Endereço
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">CEP</Label>
              <div className="flex gap-1">
                <Input
                  value={form.postal_code}
                  onChange={e => setForm({ ...form, postal_code: maskCep(e.target.value) })}
                  placeholder="00000-000"
                  inputMode="numeric"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={lookupCep}
                  disabled={cepLoading}
                  title="Buscar endereço pelo CEP"
                >
                  {cepLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
            <div className="space-y-1.5 md:col-span-4">
              <Label className="text-xs">Rua / Logradouro</Label>
              <Input
                value={form.street}
                onChange={e => setForm({ ...form, street: e.target.value })}
                placeholder="Rua das Acácias"
              />
            </div>

            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs">Número</Label>
              <Input
                value={form.number}
                onChange={e => setForm({ ...form, number: e.target.value })}
                placeholder="123"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">Complemento</Label>
              <Input
                value={form.complement}
                onChange={e => setForm({ ...form, complement: e.target.value })}
                placeholder="Apto 502, Bloco B"
              />
            </div>
            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-xs">Bairro</Label>
              <Input
                value={form.district}
                onChange={e => setForm({ ...form, district: e.target.value })}
                placeholder="Centro"
              />
            </div>

            <div className="space-y-1.5 md:col-span-3">
              <Label className="text-xs">Cidade</Label>
              <Input
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="Itajaí"
              />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="text-xs">UF</Label>
              <Input
                value={form.state}
                onChange={e => setForm({ ...form, state: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="SC"
                maxLength={2}
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label className="text-xs">País</Label>
              <Input
                value={form.country}
                onChange={e => setForm({ ...form, country: e.target.value.toUpperCase().slice(0, 2) })}
                placeholder="BR"
                maxLength={2}
              />
            </div>
          </div>
        </div>

        {/* Observações */}
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-2">
            Observações internas
          </div>
          <Textarea
            rows={3}
            value={form.address_notes}
            onChange={e => setForm({ ...form, address_notes: e.target.value })}
            placeholder="Preferências, restrições, contexto pra futuro contato..."
          />
        </div>

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={save} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Salvando...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-1.5" /> Salvar dados
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
