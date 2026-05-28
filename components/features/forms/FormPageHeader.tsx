'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft } from 'lucide-react'

type Props = {
  orgSlug: string
  form: { id: string; name: string; slug: string; is_active: boolean }
}

export default function FormPageHeader({ orgSlug, form }: Props) {
  const pathname = usePathname()
  const base = `/app/${orgSlug}/forms/${form.id}`

  const tabs = [
    { href: `${base}/edit`, label: 'Editar' },
    { href: `${base}/respostas`, label: 'Respostas' },
    { href: `${base}/insights`, label: 'Insights' },
  ]

  return (
    <div className="border-b bg-card">
      <div className="px-6 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/app/${orgSlug}/forms`}
            className="text-muted-foreground hover:text-foreground flex items-center gap-1 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Formulários
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="font-semibold text-base">{form.name}</h1>
          {form.is_active ? (
            <Badge className="bg-green-100 text-green-800 border-green-200">Ativo</Badge>
          ) : (
            <Badge variant="outline">Pausado</Badge>
          )}
          <code className="text-xs text-muted-foreground font-mono ml-2">/f/{form.slug}</code>
        </div>
      </div>
      <nav className="px-6 flex gap-1">
        {tabs.map(t => {
          const active = pathname?.startsWith(t.href)
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-primary text-foreground font-medium'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
