'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ArrowLeft } from 'lucide-react'
import { updateForm } from '@/actions/forms'

type Props = {
  orgSlug: string
  form: { id: string; name: string; slug: string; is_active: boolean }
}

export default function FormPageHeader({ orgSlug, form }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const base = `/app/${orgSlug}/forms/${form.id}`

  const [name, setName] = useState(form.name)
  const [saving, setSaving] = useState(false)

  const tabs = [
    { href: `${base}/edit`, label: 'Editar' },
    { href: `${base}/respostas`, label: 'Respostas' },
    { href: `${base}/insights`, label: 'Insights' },
  ]

  async function handleRename() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === form.name) {
      setName(form.name)
      return
    }
    setSaving(true)
    await updateForm(orgSlug, form.id, { name: trimmed })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="border-b bg-card">
      <div className="px-3 sm:px-6 pt-3 sm:pt-4 pb-2 flex items-center gap-2 sm:gap-3">
        <Link
          href={`/app/${orgSlug}/forms`}
          className="text-muted-foreground hover:text-foreground flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted shrink-0"
          aria-label="Voltar para formulários"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <Input
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          disabled={saving}
          className="font-semibold text-base border-transparent hover:border-input focus:border-input flex-1 min-w-0 max-w-md h-9 px-2"
        />
        {form.is_active ? (
          <Badge className="bg-green-100 text-green-800 border-green-200 shrink-0">Ativo</Badge>
        ) : (
          <Badge variant="outline" className="shrink-0">Pausado</Badge>
        )}
      </div>
      <nav className="px-3 sm:px-6 flex gap-1">
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
