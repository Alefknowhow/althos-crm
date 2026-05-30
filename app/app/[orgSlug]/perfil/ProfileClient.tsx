'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  updateProfileInfo,
  requestEmailChange,
  changePassword,
  type UserProfile,
} from '@/actions/profile'
import {
  User,
  Mail,
  Lock,
  Building2,
  Plus,
  ExternalLink,
  CheckCircle2,
  Eye,
  EyeOff,
} from 'lucide-react'
import Link from 'next/link'

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string, email: string) {
  if (name.trim()) {
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email[0].toUpperCase()
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Admin',
  member: 'Membro',
}

// ── Section card ─────────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function ProfileClient({
  profile,
  orgSlug,
}: {
  profile: UserProfile
  orgSlug: string
}) {
  const router = useRouter()

  // ── Dados pessoais ───────────────────────────────────────────────────────
  const [name,          setName]          = useState(profile.name)
  const [phone,         setPhone]         = useState(profile.phone)
  const [savingInfo,    setSavingInfo]    = useState(false)

  async function handleSaveInfo() {
    setSavingInfo(true)
    const res = await updateProfileInfo(name, phone)
    if (res.ok) {
      toast.success('Dados atualizados!')
      router.refresh()
    } else {
      toast.error(res.error)
    }
    setSavingInfo(false)
  }

  // ── Troca de e-mail ──────────────────────────────────────────────────────
  const [newEmail,      setNewEmail]      = useState('')
  const [emailSent,     setEmailSent]     = useState(false)
  const [savingEmail,   setSavingEmail]   = useState(false)

  async function handleEmailChange() {
    if (!newEmail.trim() || !newEmail.includes('@')) {
      toast.error('Informe um e-mail válido.')
      return
    }
    setSavingEmail(true)
    const res = await requestEmailChange(newEmail)
    if (res.ok) {
      setEmailSent(true)
      toast.success('Confirmação enviada! Verifique seu novo e-mail.')
    } else {
      toast.error(res.error)
    }
    setSavingEmail(false)
  }

  // ── Troca de senha ───────────────────────────────────────────────────────
  const [currentPass,   setCurrentPass]   = useState('')
  const [newPass,       setNewPass]       = useState('')
  const [confirmPass,   setConfirmPass]   = useState('')
  const [showPass,      setShowPass]      = useState(false)
  const [savingPass,    setSavingPass]    = useState(false)

  async function handleChangePassword() {
    if (!currentPass) {
      toast.error('Informe sua senha atual.')
      return
    }
    if (newPass.length < 8) {
      toast.error('A nova senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (newPass !== confirmPass) {
      toast.error('As senhas não coincidem.')
      return
    }
    setSavingPass(true)
    const res = await changePassword(currentPass, newPass)
    if (res.ok) {
      toast.success('Senha alterada com sucesso!')
      setCurrentPass('')
      setNewPass('')
      setConfirmPass('')
    } else {
      toast.error(res.error)
    }
    setSavingPass(false)
  }

  const infoChanged = name !== profile.name || phone !== profile.phone

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-xl font-bold text-primary-foreground shrink-0">
          {initials(profile.name, profile.email)}
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight">
            {profile.name || 'Sem nome'}
          </h1>
          <p className="text-sm text-muted-foreground">{profile.email}</p>
        </div>
      </div>

      {/* ── Dados pessoais ───────────────────────────────────────────────── */}
      <Section icon={User} title="Dados pessoais">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome completo</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="João Silva"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 9 9999-9999"
              type="tel"
              className="h-10"
            />
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveInfo}
              disabled={savingInfo || !infoChanged}
              size="sm"
              className="min-w-[120px]"
            >
              {savingInfo ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── E-mail ───────────────────────────────────────────────────────── */}
      <Section icon={Mail} title="Endereço de e-mail">
        <div className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
            <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium">{profile.email}</span>
            <Badge variant="outline" className="ml-auto text-[10px]">atual</Badge>
          </div>

          {emailSent ? (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
              <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                Um link de confirmação foi enviado para <strong>{newEmail}</strong>.
                O e-mail só será atualizado após você clicar no link.
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="new-email">Novo e-mail</Label>
                <Input
                  id="new-email"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
                  className="h-10"
                />
                <p className="text-xs text-muted-foreground">
                  Um link de confirmação será enviado para o novo endereço.
                </p>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleEmailChange}
                  disabled={savingEmail || !newEmail.trim()}
                  size="sm"
                  variant="outline"
                  className="min-w-[160px]"
                >
                  {savingEmail ? 'Enviando…' : 'Alterar e-mail'}
                </Button>
              </div>
            </>
          )}
        </div>
      </Section>

      {/* ── Segurança ─────────────────────────────────────────────────────── */}
      <Section icon={Lock} title="Segurança">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="current-pass">Senha atual</Label>
            <Input
              id="current-pass"
              type={showPass ? 'text' : 'password'}
              value={currentPass}
              onChange={e => setCurrentPass(e.target.value)}
              placeholder="sua senha atual"
              autoComplete="current-password"
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="new-pass">Nova senha</Label>
            <div className="relative">
              <Input
                id="new-pass"
                type={showPass ? 'text' : 'password'}
                value={newPass}
                onChange={e => setNewPass(e.target.value)}
                placeholder="mínimo 8 caracteres"
                autoComplete="new-password"
                className="h-10 pr-10"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPass(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm-pass">Confirmar nova senha</Label>
            <Input
              id="confirm-pass"
              type={showPass ? 'text' : 'password'}
              value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)}
              placeholder="repita a senha"
              className="h-10"
            />
            {confirmPass && newPass !== confirmPass && (
              <p className="text-xs text-destructive">As senhas não coincidem.</p>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={savingPass || !currentPass || !newPass || !confirmPass}
              size="sm"
              variant="outline"
              className="min-w-[160px]"
            >
              {savingPass ? 'Alterando…' : 'Alterar senha'}
            </Button>
          </div>
        </div>
      </Section>

      {/* ── Organizações ─────────────────────────────────────────────────── */}
      <Section icon={Building2} title="Minhas organizações">
        <div className="space-y-2">
          {profile.memberships.map((m, i) => {
            const org = m.organizations
            if (!org) return null
            const isActive = org.slug === orgSlug
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isActive
                    ? 'border-primary/40 bg-primary/5'
                    : 'border-border bg-muted/30'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABEL[m.role] ?? m.role}</p>
                </div>
                {isActive && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">atual</Badge>
                )}
                {!isActive && (
                  <Link href={`/app/${org.slug}/pipeline`}>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                      Abrir <ExternalLink className="w-3 h-3" />
                    </Button>
                  </Link>
                )}
              </div>
            )
          })}

          <div className="pt-2">
            <Link href="/onboarding?new=1">
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Nova organização
              </Button>
            </Link>
          </div>
        </div>
      </Section>

    </div>
  )
}
