'use client'

/**
 * Responsive shell around the app sidebar.
 *
 * Desktop (md+): renders a sticky aside, same as the old layout.
 * Mobile (<md): hides the aside, renders a hamburger fixed at the top-left
 *               of the viewport. Tapping it slides a drawer in from the
 *               left with the same nav contents. Drawer auto-closes on
 *               route change so the user doesn't have to dismiss it after
 *               picking a link.
 *
 * The nav contents are passed as `children` from the server-side Sidebar
 * component — that way we don't duplicate the icon imports or the
 * data-fetching for badge counts.
 */

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // Auto-close on route change. SidebarNavLink uses next/link so the
  // pathname updates as soon as the user taps an entry.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  // Lock body scroll while the mobile drawer is open — otherwise the
  // backdrop can scroll the underlying page on iOS.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      {/* Desktop aside — unchanged behavior. */}
      <aside className="hidden md:flex w-64 shrink-0 border-r border-sidebar-border bg-sidebar flex-col sticky top-0 h-screen">
        {children}
      </aside>

      {/* Mobile hamburger trigger. Fixed so it floats over the header. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menu"
        aria-expanded={open}
        className="md:hidden fixed top-2.5 left-2.5 z-40 w-10 h-10 inline-flex items-center justify-center rounded-md bg-background/90 backdrop-blur border border-border shadow-sm text-foreground active:scale-95 transition-transform"
      >
        <Menu className="w-5 h-5" strokeWidth={1.75} />
      </button>

      {/* Mobile drawer overlay + panel. */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150"
            onClick={() => setOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border flex flex-col shadow-xl animate-in slide-in-from-left duration-200"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar menu"
              className="absolute top-3 right-3 w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </button>
            {children}
          </aside>
        </div>
      )}
    </>
  )
}
