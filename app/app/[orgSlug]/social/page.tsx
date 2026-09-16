import { redirect } from 'next/navigation'

/**
 * A inbox do Instagram (Direct/Comentários) virou aba dentro do módulo
 * unificado "Conversas" (app/app/[orgSlug]/conversas) — link antigo pra
 * /social "puro" (bookmark, atalho) cai lá agora. /social/automacoes
 * continua existindo à parte, até a Fase 3 mover automações pro módulo
 * genérico.
 */
export default function SocialPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/conversas?ch=instagram`)
}
