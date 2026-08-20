/**
 * Regra de tamanho fixo do dashboard: nenhum card muda de altura conforme a
 * quantidade de linhas/dados que ele tem pra mostrar — o que não cabe rola
 * dentro do próprio card (scroll interno), a vizinhança nunca é "empurrada".
 * Usar essas constantes em vez de `h-full`/`max-h-*` arbitrários espalhados
 * por widget.
 */

/** Card de gráfico principal (linha, funil, forecast) — os que ficam
 *  emparelhados lado a lado num grid 12 colunas. */
export const CHART_CARD_H = 'h-[380px]'

/** Card de gráfico/ranking secundário (pizza, barras horizontais). */
export const COMPACT_CARD_H = 'h-[320px]'

/** Região interna com scroll — cerca de 5 linhas visíveis antes de rolar. */
export const LIST_SCROLL_H = 'h-[248px]'
