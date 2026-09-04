'use client'

/** Shared section-card wrapper for ProfileClient's sub-sections. */
export function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="bg-card border border-border rounded-none overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <h2 className="font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}
