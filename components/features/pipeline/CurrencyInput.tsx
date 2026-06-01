'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { parseCurrency } from '@/lib/utils'

/**
 * BRL currency input. Shows a formatted "R$ 1.234,56" value while keeping the
 * raw integer cents in a hidden input named `name` (default: value_cents) so it
 * submits correctly with the existing server action.
 */
export default function CurrencyInput({
  name = 'value_cents',
  defaultCents = 0,
  id,
  placeholder = 'R$ 0,00',
}: {
  name?: string
  defaultCents?: number
  id?: string
  placeholder?: string
}) {
  const [cents, setCents] = useState(defaultCents)

  const display =
    cents > 0
      ? (cents / 100).toLocaleString('pt-BR', {
          style: 'currency',
          currency: 'BRL',
        })
      : ''

  return (
    <>
      <Input
        id={id}
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={e => setCents(parseCurrency(e.target.value))}
      />
      <input type="hidden" name={name} value={cents} />
    </>
  )
}
