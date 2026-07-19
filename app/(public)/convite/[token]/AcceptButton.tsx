'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { acceptInvitation } from '@/actions/team'
import { CheckCircle2 } from 'lucide-react'

export default function AcceptButton({ token }: { token: string }) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')

  async function handle() {
    setLoading(true)
    setError('')
    const res = await acceptInvitation(token)
    if (res.ok) {
      window.location.href = res.redirectTo
    } else {
      setError(res.error)
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">{error}</p>
      )}
      <Button className="w-full gap-2" onClick={handle} disabled={loading}>
        {loading ? (
          <>
            <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            Aceitando…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4" />
            Aceitar convite e entrar
          </>
        )}
      </Button>
    </div>
  )
}
