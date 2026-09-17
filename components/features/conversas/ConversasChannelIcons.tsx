/** Ícones de canal (WhatsApp/Instagram) — usados como selo de canal em
 *  cada linha da lista unificada de Conversas (UnifiedConversasSidebar).
 *  Cores de marca fixas (verde WhatsApp / roxo-gradiente Instagram) —
 *  exceção explícita do design system pra ícones de identidade de canal
 *  (ver CLAUDE.md § Design System). */

export function IgIcon({ className = 'w-3.5 h-3.5 sm:w-4 sm:h-4' }: { className?: string }) {
  const gradId = 'ig-grad'
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24">
      <defs>
        <linearGradient id={gradId} x1="0" y1="24" x2="24" y2="0">
          <stop offset="0%" stopColor="#FEE411" />
          <stop offset="15%" stopColor="#FEDA77" />
          <stop offset="35%" stopColor="#F58529" />
          <stop offset="55%" stopColor="#DD2A7B" />
          <stop offset="75%" stopColor="#8134AF" />
          <stop offset="100%" stopColor="#515BD4" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="5.5" ry="5.5" fill={`url(#${gradId})`} />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.75" />
      <circle cx="17.4" cy="6.6" r="1.1" fill="#fff" />
    </svg>
  )
}

export function WhatsAppIcon({ className = 'w-3.5 h-3.5 sm:w-4 sm:h-4' }: { className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="12" fill="#25D366" />
      <path
        fill="#fff"
        d="M12.04 5.5c-3.66 0-6.63 2.96-6.63 6.62 0 1.17.31 2.3.88 3.3l-.94 3.42 3.5-.92a6.6 6.6 0 0 0 3.19.82h.01c3.66 0 6.62-2.97 6.62-6.62 0-1.77-.69-3.43-1.94-4.68a6.58 6.58 0 0 0-4.69-1.94Zm0 1.11c1.47 0 2.85.57 3.89 1.62a5.46 5.46 0 0 1 1.61 3.89c0 3.04-2.47 5.51-5.51 5.51a5.47 5.47 0 0 1-2.8-.77l-.2-.12-2.08.55.56-2.03-.13-.21a5.46 5.46 0 0 1-.84-2.93c0-3.04 2.47-5.5 5.5-5.5Zm-3.02 3.07c-.12 0-.3.04-.45.21-.15.17-.58.57-.58 1.39 0 .81.6 1.6.68 1.71.08.11 1.17 1.78 2.83 2.5.4.17.71.27.95.35.4.12.76.11 1.05.06.32-.05.98-.4 1.12-.79.14-.38.14-.72.1-.79-.04-.06-.15-.1-.32-.19-.17-.08-.98-.48-1.13-.54-.15-.05-.27-.08-.38.09-.11.16-.43.54-.53.65-.09.11-.19.13-.36.04-.17-.08-.7-.26-1.33-.82-.49-.44-.82-.98-.92-1.15-.09-.16-.01-.25.07-.34.08-.07.17-.19.25-.29.08-.1.11-.16.16-.28.05-.11.03-.21-.01-.29-.04-.09-.38-.92-.52-1.25-.13-.32-.27-.28-.38-.28-.09-.01-.2-.01-.31-.01Z"
      />
    </svg>
  )
}
