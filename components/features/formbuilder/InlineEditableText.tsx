'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface Props {
  value: string
  onCommit: (value: string) => void
  placeholder?: string
  as?: 'input' | 'textarea'
  className?: string
  inputClassName?: string
}

/** Texto que parece estático até o usuário passar o mouse/focar — aí revela
 *  a borda e vira editável, commitando no blur (mesmo padrão de
 *  FormPageHeader.tsx, o idioma já usado no projeto pra "clicar e editar
 *  direto"). Usado no preview central pra editar título/descrição/opções
 *  sem passar pelo painel de propriedades. */
export default function InlineEditableText({
  value, onCommit, placeholder, as = 'input', className = '', inputClassName = '',
}: Props) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])

  const base = cn(
    'w-full bg-transparent border border-transparent rounded px-1.5 -mx-1.5 hover:border-input focus:border-input focus:outline-none focus:ring-1 focus:ring-ring transition-colors placeholder:italic placeholder:text-muted-foreground/60',
    inputClassName,
  )

  function commit() {
    if (draft !== value) onCommit(draft)
  }

  if (as === 'textarea') {
    return (
      <textarea
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        placeholder={placeholder}
        rows={2}
        className={cn(base, 'resize-none', className)}
      />
    )
  }

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder={placeholder}
      className={cn(base, className)}
    />
  )
}
