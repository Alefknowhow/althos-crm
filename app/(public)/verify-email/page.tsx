import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { MailCheck } from 'lucide-react'
import Link from 'next/link'

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader className="items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-2">
            <MailCheck className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Verifique seu e-mail</CardTitle>
          <CardDescription>
            Enviamos um link de confirmação para o seu endereço de e-mail.
            Clique nele para ativar sua conta e acessar o CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Não encontrou? Verifique a pasta de <strong>spam</strong> ou lixo eletrônico.
          </p>
          <p>
            Já confirmou?{' '}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Faça login
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
