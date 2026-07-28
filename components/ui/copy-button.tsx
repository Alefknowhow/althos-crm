'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

/** Botão discreto de copiar — ícone só, com feedback rápido de "copiado". */
export default function CopyButton({
  value,
  label = 'valor',
  className,
}: {
  value: string | null | undefined
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!value) return
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copiado`)
    setTimeout(() => setCopied(false), 1500)
  }

  if (!value) return null

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copiar ${label}`}
      aria-label={`Copiar ${label}`}
      className={cn(
        'shrink-0 text-muted-foreground/60 hover:text-foreground transition-colors',
        className,
      )}
    >
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500" />
        : <Copy className="w-3.5 h-3.5" />
      }
    </button>
  )
}
