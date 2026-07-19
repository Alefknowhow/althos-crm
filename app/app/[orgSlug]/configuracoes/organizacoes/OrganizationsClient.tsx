'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import {
  renameOrganization,
  updateOrgCompanyById,
  type ManagedOrganization,
} from '@/actions/organization'
import { setOrgVisibility, type TeamMember } from '@/actions/team'
import type { OrgCompanyData } from '@/actions/organization'
import {
  Building2, ChevronDown, Loader2, Eye, EyeOff, Users, Crown,
} from 'lucide-react'

const COMPANY_FIELDS: { key: keyof OrgCompanyData; label: string; placeholder?: string; type?: string }[] = [
  { key: 'cnpj',           label: 'CNPJ',             placeholder: '00.000.000/0000-00' },
  { key: 'cadastur',       label: 'CADASTUR',         placeholder: 'Nº do CADASTUR' },
  { key: 'contact_phone',  label: 'Telefone',         placeholder: '(11) 99999-9999' },
  { key: 'contact_email',  label: 'E-mail comercial', placeholder: 'contato@empresa.com', type: 'email' },
  { key: 'instagram',      label: 'Instagram',        placeholder: '@suaempresa' },
  { key: 'website',        label: 'Site',             placeholder: 'https://www.empresa.com' },
  { key: 'address_street', label: 'Endereço',         placeholder: 'Rua, número, bairro' },
  { key: 'address_city',   label: 'Cidade',           placeholder: 'São Paulo' },
  { key: 'address_state',  label: 'Estado (UF)',      placeholder: 'SP' },
  { key: 'address_zip',    label: 'CEP',              placeholder: '00000-000' },
]

function initials(name: string, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return (email?.[0] ?? '?').toUpperCase()
}

// ── Per-org member access (reuses the visibility model) ─────────────────────────

function OrgAccess({
  orgSlug,
  orgId,
  members,
  canManage,
}: {
  orgSlug:   string
  orgId:     string
  members:   TeamMember[]
  canManage: boolean
}) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)

  async function toggle(userId: string, currentlyHidden: boolean) {
    setPending(userId)
    const res = await setOrgVisibility(orgSlug, userId, orgId, !currentlyHidden)
    if (res.ok) {
      toast.success(!currentlyHidden ? 'Acesso removido.' : 'Acesso liberado.')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setPending(null)
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        <Users className="w-3 h-3" /> Acesso dos membros
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
        {members.map(m => {
          const isManager = m.is_owner || m.account_role === 'admin'
          const ov = m.orgs.find(o => o.org_id === orgId)
          const hidden = !!ov?.hidden
          const visible = !hidden
          return (
            <button
              key={m.user_id}
              type="button"
              disabled={!canManage || isManager || pending === m.user_id}
              onClick={() => toggle(m.user_id, hidden)}
              className={cn(
                'flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-sm transition-colors',
                isManager
                  ? 'border-amber-200 bg-amber-50/60 text-foreground cursor-default'
                  : visible
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-transparent text-muted-foreground',
                canManage && !isManager ? 'hover:border-primary/30 cursor-pointer' : '',
              )}
              title={
                isManager
                  ? 'Administradores e o proprietário sempre têm acesso'
                  : visible ? 'Clique para remover o acesso' : 'Clique para liberar o acesso'
              }
            >
              <span className="flex items-center gap-2 min-w-0">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                  {initials(m.name, m.email)}
                </span>
                <span className="truncate">{m.name || m.email}</span>
              </span>
              {isManager
                ? <Crown className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                : visible
                  ? <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                  : <EyeOff className="w-3.5 h-3.5 shrink-0" />}
            </button>
          )
        })}
      </div>
      {!canManage && (
        <p className="text-xs text-muted-foreground">Somente administradores da conta podem alterar o acesso.</p>
      )}
    </div>
  )
}

// ── Single org card ─────────────────────────────────────────────────────────────

function OrgCard({
  orgSlug,
  org,
  members,
  canManage,
  defaultOpen,
}: {
  orgSlug:     string
  org:         ManagedOrganization
  members:     TeamMember[]
  canManage:   boolean
  defaultOpen: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(defaultOpen)
  const [name, setName] = useState(org.name)
  const [company, setCompany] = useState<OrgCompanyData>(org.company)
  const [savingName, startName] = useTransition()
  const [savingCompany, startCompany] = useTransition()

  const nameDirty = name.trim() !== org.name && name.trim().length >= 2
  const companyDirty = COMPANY_FIELDS.some(f => (company[f.key] ?? '') !== (org.company[f.key] ?? ''))

  function saveName() {
    startName(async () => {
      const res = await renameOrganization(orgSlug, org.id, name)
      if (res.ok) { toast.success('Organização renomeada!'); router.refresh() }
      else toast.error(res.error || 'Não foi possível salvar.')
    })
  }

  function saveCompany() {
    startCompany(async () => {
      const res = await updateOrgCompanyById(orgSlug, org.id, company)
      if (res.ok) { toast.success('Dados da empresa salvos!'); router.refresh() }
      else toast.error(res.error || 'Não foi possível salvar.')
    })
  }

  return (
    <div className="rounded-none border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <Building2 className="w-4.5 h-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{org.name}</p>
          <p className="text-xs text-muted-foreground truncate">/{org.slug}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="border-t border-border px-5 py-5 space-y-6">
          {/* Identidade */}
          <div className="space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Identidade</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome da Organização</Label>
                <Input value={name} onChange={e => setName(e.target.value)} disabled={!canManage} />
              </div>
              <div className="space-y-2">
                <Label>Slug (URL)</Label>
                <Input disabled value={org.slug} />
              </div>
            </div>
            {canManage && (
              <Button size="sm" onClick={saveName} disabled={!nameDirty || savingName}>
                {savingName && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar nome
              </Button>
            )}
          </div>

          {/* Dados da empresa */}
          <div className="space-y-3 border-t border-border pt-5">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Dados da Empresa</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Aparecem no cabeçalho e rodapé das propostas geradas por esta organização.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {COMPANY_FIELDS.map(f => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <Input
                    type={f.type || 'text'}
                    value={company[f.key] ?? ''}
                    placeholder={f.placeholder}
                    disabled={!canManage}
                    onChange={e => setCompany(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            {canManage && (
              <Button size="sm" onClick={saveCompany} disabled={!companyDirty || savingCompany}>
                {savingCompany && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Salvar dados
              </Button>
            )}
          </div>

          {/* Acesso dos membros */}
          {members.length > 0 && (
            <div className="border-t border-border pt-5">
              <OrgAccess orgSlug={orgSlug} orgId={org.id} members={members} canManage={canManage} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────────

export default function OrganizationsClient({
  orgSlug,
  organizations,
  members,
  canManage,
}: {
  orgSlug:       string
  organizations: ManagedOrganization[]
  members:       TeamMember[]
  canManage:     boolean
}) {
  if (organizations.length === 0) {
    return (
      <div className="rounded-none border border-border bg-card p-10 text-center text-sm text-muted-foreground">
        Nenhuma organização encontrada.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Gerencie cada organização da sua conta: nome, dados da empresa e quais membros têm acesso.
      </p>
      {organizations.map((org, i) => (
        <OrgCard
          key={org.id}
          orgSlug={orgSlug}
          org={org}
          members={members}
          canManage={canManage}
          defaultOpen={organizations.length === 1 || i === 0}
        />
      ))}
    </div>
  )
}
