/**
 * Tasks actions -- barrel. Split across three files (each carries its own
 * 'use server'; this file only re-exports, so it doesn't need one):
 *   - tasks-crud.ts: create/list/update/delete + status/priority setters
 *   - tasks-related-entities.ts: searchRelatedEntities
 *   - tasks-columns.ts: Kanban column CRUD
 */

export {
  createTask, listTasksForSale, listTasksForContato, updateTask, deleteTask,
  toggleTaskStatus, setTaskStatus, setTaskPriority,
  type TaskInput, type SaleTaskRow, type TaskUpdateInput,
} from './tasks-crud'
export { searchRelatedEntities, type RelatedEntityOption } from './tasks-related-entities'
export { listTaskColumns, createTaskColumn, renameTaskColumn, deleteTaskColumn, moveTaskToColumn, ensureDefaultColumnId } from './tasks-columns'
