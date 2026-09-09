import { describe, expect, it } from 'vitest'
import { TASK_COLORS, TASK_COLOR_IDS, taskColor } from '@/lib/tasks/colors'
import { taskSchema } from '@/lib/validators/task'

describe('cores das tarefas', () => {
  it('oferece dez opções únicas aceitas no cadastro e na edição', () => {
    expect(TASK_COLORS).toHaveLength(10)
    expect(new Set(TASK_COLORS.map(c => c.id)).size).toBe(10)
    expect(TASK_COLORS.map(c => c.id)).toEqual([...TASK_COLOR_IDS])
    for (const color of TASK_COLOR_IDS) {
      expect(taskSchema.safeParse({ title: 'Retornar ao cliente', color }).success).toBe(true)
      expect(taskSchema.shape.color.safeParse(color).success).toBe(true)
      expect(taskColor(color).id).toBe(color)
    }
  })
  it('preserva compatibilidade com tarefas sem cor e integrações antigas', () => {
    expect(taskSchema.safeParse({ title: 'Tarefa antiga' }).success).toBe(true)
    expect(taskSchema.safeParse({ title: 'Tarefa antiga', color: null }).success).toBe(true)
    expect(taskColor(null).id).toBe('blue')
    expect(taskColor(undefined).id).toBe('blue')
  })
  it('rejeita valores fora da paleta e não os utiliza como CSS', () => {
    for (const color of ['#123456', 'url(javascript:alert(1))', 'transparent', '']) {
      expect(taskSchema.shape.color.safeParse(color).success).toBe(false)
      expect(taskColor(color).id).toBe('blue')
    }
  })
})
