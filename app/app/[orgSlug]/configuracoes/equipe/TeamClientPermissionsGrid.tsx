'use client'

import { groupedModules, type Permissions, type PermissionKey } from '@/lib/permissions'

// ── Permission checkboxes ─────────────────────────────────────────────────────

export function PermissionsGrid({
  permissions,
  onChange,
  disabled,
  isTravel,
}: {
  permissions: Permissions
  onChange:    (p: Permissions) => void
  disabled?:   boolean
  isTravel?:   boolean
}) {
  const groups = groupedModules(isTravel)

  function toggle(key: PermissionKey) {
    onChange({ ...permissions, [key]: !permissions[key] })
  }

  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([section, modules]) => (
        <div key={section}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {section}
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            {modules.map(m => (
              <label
                key={m.key}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                  permissions[m.key]
                    ? 'border-primary/40 bg-primary/5 text-foreground'
                    : 'border-border bg-transparent text-muted-foreground'
                } ${disabled ? 'opacity-50 pointer-events-none' : 'hover:border-primary/30'}`}
              >
                <input
                  type="checkbox"
                  className="accent-primary"
                  checked={!!permissions[m.key]}
                  onChange={() => toggle(m.key)}
                  disabled={disabled}
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
