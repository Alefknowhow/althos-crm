'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { LogOut } from 'lucide-react'

/**
 * Sai da sessão atual (que não bate com o e-mail do convite) e recarrega a
 * própria página de convite — na volta, sem usuário logado, o fluxo cai
 * corretamente no cadastro de senha (novo convidado) ou no login (conta já
 * existente).
 */
export default function SwitchAccountButton() {
  const [loading, setLoading] = useState(false)

  async function handle() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <Button variant="outline" className="w-full gap-2" onClick={handle} disabled={loading}>
      <LogOut className="w-4 h-4" />
      {loading ? 'Saindo…' : 'Sair e continuar'}
    </Button>
  )
}
