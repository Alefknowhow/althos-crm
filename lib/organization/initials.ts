// Pure helper — kept out of active-context.ts (which pulls in server-only
// Supabase/Next imports) so it can be unit-tested without a server runtime.

export function deriveInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
