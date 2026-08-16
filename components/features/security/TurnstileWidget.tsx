'use client'

import Script from 'next/script'

/**
 * Cloudflare Turnstile — widget "implícito": o script oficial escaneia o DOM
 * por `<div class="cf-turnstile">` e injeta sozinho um
 * `<input type="hidden" name="cf-turnstile-response">` dentro dela quando o
 * desafio é resolvido.
 *
 * Escopo: só login, cadastro e recuperação de senha (actions/auth.ts) — não
 * usado nos formulários públicos/agendamento.
 *
 * Opcional: sem NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY configurada, não
 * renderiza nada (o backend já trata a ausência do token como "Turnstile
 * desativado nesse deploy" — ver lib/security/antispam.ts).
 */
export default function TurnstileWidget({ action }: { action?: string }) {
  const sitekey = process.env.NEXT_PUBLIC_CLOUDFLARE_TURNSTILE_SITEKEY
  if (!sitekey) return null

  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer />
      <div className="cf-turnstile" data-sitekey={sitekey} data-action={action} data-theme="auto" />
    </>
  )
}
