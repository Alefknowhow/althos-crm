/**
 * Layout for all public (unauthenticated) pages.
 * Forces light-mode CSS variables regardless of the user's OS theme,
 * so login/signup/invite screens always look like designed.
 */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="light">
      {children}
    </div>
  )
}
