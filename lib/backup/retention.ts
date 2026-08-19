/**
 * Política de retenção — diário/semanal/mensal, valores default do
 * plano de backup (seção 5 do prompt original). Configurável no
 * futuro via `system_config`; por ora, constantes — trocar aqui é
 * suficiente até existir um lugar de configuração dedicado.
 */

export const RETENTION_DAYS = {
  daily: 30,
  weekly: 12 * 7, // 12 semanas
  monthly: 12 * 30, // 12 meses (aproximado)
} as const

export type RetentionTier = keyof typeof RETENTION_DAYS

/** Um backup vira weekly no domingo, monthly no dia 1 — além do daily
 *  de sempre. Determina os tiers aplicáveis pra uma data de backup. */
export function tiersForDate(date: Date): RetentionTier[] {
  const tiers: RetentionTier[] = ['daily']
  if (date.getUTCDay() === 0) tiers.push('weekly')
  if (date.getUTCDate() === 1) tiers.push('monthly')
  return tiers
}

/** true se um objeto de backup datado de `createdAt`, no tier `tier`,
 *  já passou do prazo de retenção e pode ser apagado. */
export function isExpired(createdAt: Date, tier: RetentionTier, now: Date = new Date()): boolean {
  const ageMs = now.getTime() - createdAt.getTime()
  const retentionMs = RETENTION_DAYS[tier] * 24 * 60 * 60 * 1000
  return ageMs > retentionMs
}

/** Extrai a data (YYYY-MM-DD) embutida no nome de um objeto de backup
 *  datado (`database/daily/2026-08-19.enc`, `manifests/weekly/database-2026-08-17.json`)
 *  — null se a key não tiver o formato esperado (não deve ser apagada
 *  por segurança: melhor manter algo estranho do que apagar por engano). */
export function extractDateFromKey(key: string): Date | null {
  const match = key.match(/(\d{4}-\d{2}-\d{2})/)
  if (!match) return null
  const d = new Date(`${match[1]}T00:00:00Z`)
  return isNaN(d.getTime()) ? null : d
}
