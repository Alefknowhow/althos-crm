/**
 * Raiz da camada mobile Material 3 (reformulação mobile, G1). Aplica
 * `data-mobile-shell` (liga os tokens M3 escopados em app/globals.css) e
 * `font-mobile` (Roboto). Nunca usar fora do shell autenticado mobile —
 * desktop e páginas públicas continuam com os tokens shadcn de sempre.
 */
export function MobileShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-mobile-shell className={`font-mobile bg-m3-surface text-m3-on-surface min-h-full ${className}`}>
      {children}
    </div>
  )
}
