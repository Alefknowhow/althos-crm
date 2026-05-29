'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOrganization } from '@/actions/organization'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export default function OnboardingForm() {
  const router = useRouter()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    const result = await createOrganization(formData)

    if (!result.ok) {
      setError(result.error || 'Erro ao criar organização. Tente um nome diferente.')
      setLoading(false)
    } else {
      // Hard navigate to guarantee the new session/cookie is picked up
      window.location.href = result.redirectTo!
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Nova Organização</CardTitle>
          <CardDescription>Crie um workspace para começar a usar.</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && <div className="text-sm font-medium text-destructive">{error}</div>}
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Organização</Label>
              <Input id="name" name="name" required placeholder="Minha Agência" />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar e Continuar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
