/**
 * Próxima data (ISO) em que uma operadora com pagamento no dia `day` do mês
 * paga a comissão, a partir de `from` (hoje, por padrão). Se `day` já passou
 * neste mês, cai pro mês seguinte; se ainda não chegou, é neste mês mesmo.
 */
export function nextOperatorPaymentDate(day: number, from = new Date()): string {
  const todayDay = from.getUTCDate()
  const monthOffset = todayDay <= day ? 0 : 1
  const target = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + monthOffset, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(day, lastDay))
  return target.toISOString().slice(0, 10)
}

/**
 * Data de pagamento (ISO) de operadoras que pagam por "decêndio" — cada mês
 * se divide em 3 blocos de ~10 dias (1-10, 11-20, 21-fim do mês); a
 * operadora paga `offsetDays` dias depois que o decêndio em que a venda caiu
 * se fecha. Ex.: venda no dia 7 (1º decêndio, fecha dia 10) com offset 15 →
 * paga dia 25.
 */
export function nextDecendioPaymentDate(offsetDays: number, from = new Date()): string {
  const day = from.getUTCDate()
  const lastDayOfMonth = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 0)).getUTCDate()
  const decendioEndDay = day <= 10 ? 10 : day <= 20 ? 20 : lastDayOfMonth

  const decendioEnd = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), decendioEndDay))
  decendioEnd.setUTCDate(decendioEnd.getUTCDate() + offsetDays)
  return decendioEnd.toISOString().slice(0, 10)
}
