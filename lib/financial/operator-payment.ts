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
