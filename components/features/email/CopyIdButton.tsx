'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { toast } from 'sonner'

export default function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(id)
    setCopied(true)
    toast.success('ID copiado!')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar ID para uso nas automações"
      className="group flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
    >
      <span className="hidden sm:inline">{id.slice(0, 8)}…</span>
      {copied
        ? <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
        : <Copy className="w-3.5 h-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
      }
    </button>
  )
}
