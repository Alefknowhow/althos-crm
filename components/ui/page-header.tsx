'use client'

import * as React from 'react'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { usePageHint } from '@/components/features/PageHintContext'

interface PageHeaderProps {
  /** Page title rendered as an h1. */
  title: string
  /** Optional hint — pushed up to the (!) icon in the top bar, next to the page title. */
  hint?: string
  /** Optional actions rendered on the right side of the header row. */
  actions?: React.ReactNode
  className?: string
}

/**
 * Standard page header for the CRM. O nome da página mora na barra superior
 * (primeira linha, ao lado do botão de recolher a sidebar) e o hint (!)
 * agora vai pra lá também — este componente só registra o hint no contexto
 * e renderiza as ações, pra não gastar mais uma linha inteira em cada tela.
 */
export function PageHeader({ title: _title, hint, actions, className }: PageHeaderProps) {
  const { setHint } = usePageHint()

  useEffect(() => {
    setHint(hint || null)
    return () => setHint(null)
  }, [hint, setHint])

  if (!actions) return null
  return (
    <div className={cn('flex items-start justify-end gap-3', className)}>
      <div className="shrink-0 flex items-center gap-2">{actions}</div>
    </div>
  )
}
