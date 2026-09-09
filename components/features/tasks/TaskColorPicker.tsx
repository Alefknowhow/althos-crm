'use client'

import { Check } from 'lucide-react'
import { TASK_COLORS, DEFAULT_TASK_COLOR, type TaskColor } from '@/lib/tasks/colors'
import { cn } from '@/lib/utils'

export default function TaskColorPicker({ value, defaultValue, onChange }: {
  value?: string | null
  defaultValue?: string | null
  onChange?: (color: TaskColor) => void
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">Cor na timeline</legend>
      <div className="flex flex-wrap gap-2">
        {TASK_COLORS.map(color => (
          <label key={color.id} className="relative cursor-pointer" title={color.label}>
            <input
              type="radio" name="color" value={color.id} aria-label={color.label}
              className="peer sr-only"
              checked={value !== undefined ? (value ?? DEFAULT_TASK_COLOR) === color.id : undefined}
              defaultChecked={value === undefined ? (defaultValue ?? DEFAULT_TASK_COLOR) === color.id : undefined}
              onChange={() => onChange?.(color.id)}
            />
            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full ring-offset-2 ring-offset-background peer-checked:ring-2 peer-checked:ring-foreground peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 [&>svg]:invisible peer-checked:[&>svg]:visible', color.className)}>
              <Check className="h-4 w-4" aria-hidden="true" />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}
