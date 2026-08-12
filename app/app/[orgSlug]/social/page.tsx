import { redirect } from 'next/navigation'

/**
 * Direct Inbox é a aba padrão do hub do Instagram — qualquer link pra
 * /social "puro" (sidebar, atalhos, etc.) cai direto na inbox em vez de
 * Automações, que agora vive em /social/automacoes.
 */
export default function SocialPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}/social/inbox`)
}
