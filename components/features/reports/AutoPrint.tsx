'use client'

import { useEffect } from 'react'

/**
 * Fires the browser print dialog once the printable report has painted. The
 * user then "saves as PDF" — no PDF library needed (same approach as the
 * travel proposal print view).
 */
export default function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 350)
    return () => clearTimeout(t)
  }, [])
  return null
}
