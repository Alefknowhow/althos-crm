/**
 * Roteirista actions -- barrel. Split across three files (each carries its
 * own 'use server'; this file only re-exports, so it doesn't need one):
 *   - roteirista-core.ts: access check, CRUD, chat (startRoteiro, sendRoteiroMessage, ...)
 *   - roteirista-convert.ts: convertRoteiroToQuotation
 *   - roteirista-knowledge.ts: knowledge-base CRUD
 */

export {
  requireRoteiristaAccess, listRoteiros, getRoteiro, deleteRoteiro, listRoteiroMessages,
  startRoteiro, sendRoteiroMessage,
  type RoteiroGeneration, type RoteiroMessage,
} from './roteirista-core'
export { convertRoteiroToQuotation } from './roteirista-convert'
export {
  listRoteiristaKnowledge, addRoteiristaKnowledge, deleteRoteiristaKnowledge,
  type RoteiristaKnowledgeItem,
} from './roteirista-knowledge'
