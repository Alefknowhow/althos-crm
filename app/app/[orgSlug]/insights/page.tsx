import { redirect } from 'next/navigation'

/**
 * Insights IA foi absorvida pela Inicial (copiloto no dock lateral).
 * Mantém a URL antiga funcionando para quem tinha o link salvo/favoritado.
 */
export default function InsightsRedirectPage({ params }: { params: { orgSlug: string } }) {
  redirect(`/app/${params.orgSlug}`)
}
