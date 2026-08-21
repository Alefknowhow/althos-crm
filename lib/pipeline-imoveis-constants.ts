/**
 * Constantes do Pipeline Imobiliário (Fase 7) — separadas de
 * actions/pipeline-imoveis.ts porque arquivos 'use server' só podem
 * exportar funções async; essas constantes precisam ser importadas tanto
 * pela action quanto pela function Inngest (lib/inngest/imoveis-pipeline-advance.ts).
 */

export const REAL_ESTATE_PIPELINE_KIND = 'imoveis'

export const REAL_ESTATE_PIPELINE_STAGES: { name: string; is_won?: boolean; is_lost?: boolean }[] = [
  { name: 'Captação de interesse' },
  { name: 'Visita agendada' },
  { name: 'Visita realizada' },
  { name: 'Proposta enviada' },
  { name: 'Em negociação' },
  { name: 'Fechado', is_won: true },
  { name: 'Perdido', is_lost: true },
]
