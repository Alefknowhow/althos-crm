import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import TaskCard from '@/components/features/TaskCard'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

interface TasksTodayProps {
  tasks: any[]
  orgSlug: string
}

export default function TasksToday({ tasks, orgSlug }: TasksTodayProps) {
  return (
    <Card className="reveal">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base tracking-apple-tighter">Tarefas hoje</CardTitle>
        <Link
          href={`/app/${orgSlug}/tarefas`}
          className="text-xs text-primary hover:text-primary/80 font-medium tracking-apple-snug inline-flex items-center gap-0.5 transition-colors"
        >
          Ver todas <ArrowRight className="w-3 h-3" />
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {tasks && tasks.length > 0 ? (
            tasks.map(task => (
              <TaskCard key={task.id} task={task} orgSlug={orgSlug} />
            ))
          ) : (
            <div className="text-sm text-muted-foreground p-6 text-center border border-dashed border-border rounded-xl tracking-apple-snug">
              Você não tem tarefas para hoje
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
