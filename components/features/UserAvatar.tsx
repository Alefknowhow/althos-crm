function initials(name: string, email: string) {
  if (name?.trim()) {
    const parts = name.trim().split(' ')
    return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
  }
  return email?.[0]?.toUpperCase() ?? '?'
}

/** Avatar de usuário — foto se `avatarUrl` estiver presente, iniciais
 *  como fallback (mesmo padrão visual já usado no resto do app). */
export default function UserAvatar({
  name, email, avatarUrl, size = 28,
}: { name: string; email: string; avatarUrl?: string | null; size?: number }) {
  const style = { width: size, height: size }
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt="" style={style} className="rounded-full object-cover shrink-0" />
  }
  return (
    <div
      style={{ ...style, fontSize: size * 0.4 }}
      className="rounded-full bg-primary flex items-center justify-center font-bold text-primary-foreground shrink-0"
    >
      {initials(name, email)}
    </div>
  )
}
