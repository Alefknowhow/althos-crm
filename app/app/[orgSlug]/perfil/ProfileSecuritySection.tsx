'use client'

/**
 * Password-change section for ProfileClient. Owns its own local state.
 * Split out of ProfileClient.tsx.
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Lock, Eye, EyeOff } from 'lucide-react'
import { changePassword } from '@/actions/profile'
import { Section } from './ProfileSection'

export function ProfileSecuritySection() {
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [savingPass, setSavingPass] = useState(false)

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

  return (
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
  )
}
