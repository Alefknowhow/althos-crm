'use client'

import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'

export type ResponsiveSelectOption = { value: string; label: string }

/**
 * Thin wrapper over the shadcn Select that takes a flat `options` array.
 * Use this for filter/toolbar dropdowns so the whole app shares one styled
 * control (instead of mixing native <select> with the shadcn Select).
 */
export function ResponsiveSelect({
  value,
  onValueChange,
  options,
  placeholder,
  className,
  'aria-label': ariaLabel,
}: {
  value: string
  onValueChange: (v: string) => void
  options: ResponsiveSelectOption[]
  placeholder?: string
  className?: string
  'aria-label'?: string
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
