'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen]   = useState(false)
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const pathname          = usePathname()
  const closeRef          = useRef<HTMLButtonElement>(null)

  // Auto-close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Mount after hydration to avoid SSR mismatch + restore collapsed preference
  useEffect(() => {
    setMounted(true)
    try { setCollapsed(localStorage.getItem('sidebar-collapsed') === '1') } catch {}
  }, [])

  function toggleCollapsed() {
    setCollapsed(v => {
      const next = !v
      try { localStorage.setItem('sidebar-collapsed', next ? '1' : '0') } catch {}
      return next
    })
  }

  // Lock body scroll while drawer is open (iOS fix)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  // Focus close button when drawer opens (accessibility)
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  return (
    <>
      {/* Desktop aside */}
      <aside
        data-collapsed={collapsed}
        className={cn(
          'group hidden md:flex shrink-0 border-r border-sidebar-border bg-sidebar flex-col sticky top-0 h-screen relative transition-[width] duration-200 ease-out',
          collapsed ? 'w-16 sidebar-collapsed' : 'w-64',
        )}
      >
        {children}

        {/* Collapse / expand toggle — pinned to the header row (h-14). */}
        <button
          type="button"
          onClick={toggleCollapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          title={collapsed ? 'Expandir' : 'Recolher'}
          className={cn(
            'absolute top-3.5 w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-all z-10',
            collapsed
              // Collapsed: center the toggle and reveal it only on hover so it
              // never overlaps the centered logo mark (logo fades out on hover).
              ? 'left-1/2 -translate-x-1/2 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto'
              : 'right-2',
          )}
        >
          {collapsed
            ? <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} />
            : <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />}
        </button>
      </aside>

      {/* Mobile hamburger — only after hydration to avoid flash */}
      {mounted && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir menu"
          aria-expanded={open}
          className="md:hidden fixed top-2.5 left-2.5 z-40 w-10 h-10 inline-flex items-center justify-center rounded-md bg-background/90 backdrop-blur border border-border shadow-sm text-foreground active:scale-95 transition-transform"
        >
          <Menu className="w-5 h-5" strokeWidth={1.75} />
        </button>
      )}

      {/* Mobile drawer — always in the DOM after mount, visibility toggled via CSS.
          This avoids unmount/remount crashes on iOS Safari with server-action children. */}
      {mounted && (
        <div
          className="md:hidden fixed inset-0 z-50"
          style={{
            pointerEvents: open ? 'auto' : 'none',
            visibility: open ? 'visible' : 'hidden',
          }}
          role="dialog"
          aria-modal="true"
          aria-hidden={!open}
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 transition-opacity duration-200"
            style={{ opacity: open ? 1 : 0 }}
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <aside
            className="absolute inset-y-0 left-0 w-[280px] max-w-[85vw] bg-sidebar border-r border-sidebar-border flex flex-col shadow-xl transition-transform duration-200 ease-out"
            style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
          >
            <button
              ref={closeRef}
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
