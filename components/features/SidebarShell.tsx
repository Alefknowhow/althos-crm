'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Logo } from '@/components/brand/Logo'
import { useSidebarCollapse } from './SidebarCollapseContext'

export default function SidebarShell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  // Estado do drawer mobile vem do contexto compartilhado (não mais
  // useState local) — permite a barra inferior "Módulos" (MobileBottomNav,
  // reformulação mobile G2) abrir este mesmo drawer.
  const { collapsed, mobileOpen: open, setMobileOpen: setOpen } = useSidebarCollapse()
  const pathname          = usePathname()
  const closeRef          = useRef<HTMLButtonElement>(null)

  // Auto-close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Mount after hydration to avoid SSR mismatch
  useEffect(() => { setMounted(true) }, [])

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
          'group hidden md:flex shrink-0 border-r border-sidebar-border bg-sidebar flex-col h-full relative transition-[width] duration-200 ease-out',
          collapsed ? 'w-16 sidebar-collapsed' : 'w-64',
        )}
      >
        {children}
      </aside>

      {/* O antigo hamburger fixo (top-2.5 left-2.5) foi removido na
          reformulação mobile (G2) — colidia com banners (diagnóstico 2.2) e
          duplicava a entrada "Módulos" da nova barra inferior
          (MobileBottomNav), que agora é o único jeito de abrir este drawer
          no mobile. `setOpen`/`open` seguem vindo do contexto compartilhado. */}

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
            className="absolute inset-y-0 left-0 w-[78%] max-w-[320px] bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-200 ease-out shadow-xl"
            style={{ transform: open ? 'translateX(0)' : 'translateX(-100%)' }}
          >
            <div className="h-14 border-b border-sidebar-border flex items-center justify-between px-4 shrink-0">
              <Logo className="sidebar-brand" v2 />
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar menu"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {children}
          </aside>
        </div>
      )}
    </>
  )
}
