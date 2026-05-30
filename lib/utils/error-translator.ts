/**
 * Traduz mensagens de erro do Supabase / backend para português legível.
 * Sempre retorna uma string segura para exibir ao usuário.
 */
export function traduzirErro(error: unknown, fallback = 'Ocorreu um erro inesperado. Tente novamente.'): string {
  if (!error) return fallback

  const msg: string =
    typeof error === 'string'
      ? error
      : (error as any)?.message || (error as any)?.error || String(error)

  // ── Auth ────────────────────────────────────────────────────────────────────
  if (msg.includes('Invalid login credentials'))
    return 'E-mail ou senha incorretos.'
  if (msg.includes('Email not confirmed'))
    return 'Confirme seu e-mail antes de entrar.'
  if (msg.includes('not authenticated') || msg.includes('Usuário não autenticado'))
    return 'Você precisa estar logado.'
  if (msg.includes('JWT expired') || msg.includes('session_not_found'))
    return 'Sua sessão expirou. Faça login novamente.'
  if (msg.includes('User already registered'))
    return 'Já existe uma conta com esse e-mail.'
  if (msg.includes('Password should be at least'))
    return 'A senha deve ter pelo menos 6 caracteres.'
  if (msg.includes('over_email_send_rate_limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'

  // ── Unique constraints ───────────────────────────────────────────────────────
  if (msg.includes('duplicate key') || msg.includes('unique constraint')) {
    if (msg.includes('slug'))     return 'Esse nome/URL já está em uso. Escolha outro.'
    if (msg.includes('email'))    return 'Esse e-mail já está cadastrado.'
    if (msg.includes('phone'))    return 'Esse telefone já está cadastrado.'
    if (msg.includes('sku'))      return 'Esse código SKU já está em uso.'
    return 'Registro duplicado. Verifique os dados e tente novamente.'
  }

  // ── RLS / permission ─────────────────────────────────────────────────────────
  if (msg.includes('row-level security') || msg.includes('new row violates'))
    return 'Você não tem permissão para realizar essa ação.'
  if (msg.includes('Você não tem permissão'))
    return msg // já traduzido pelo RBAC checker

  // ── FK violations ────────────────────────────────────────────────────────────
  if (msg.includes('foreign key') || msg.includes('violates foreign key'))
    return 'Não é possível excluir: esse registro está vinculado a outros dados.'

  // ── Limits ──────────────────────────────────────────────────────────────────
  if (msg.includes('Limite de leads'))   return msg
  if (msg.includes('Limite de usuários')) return msg

  // ── Network / timeout ────────────────────────────────────────────────────────
  if (msg.includes('fetch failed') || msg.includes('Failed to fetch'))
    return 'Sem conexão com o servidor. Verifique sua internet.'
  if (msg.includes('timeout'))
    return 'A requisição demorou muito. Tente novamente.'

  // ── Fallback: retorna a mensagem original se for legível ────────────────────
  if (msg.length < 120 && !msg.includes('Error:') && !msg.includes('at ')) {
    return msg
  }

  return fallback
}
