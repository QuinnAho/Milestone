import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { atom, useAtom } from 'jotai'

export interface TaskSummary extends Record<string, unknown> {
  task_id?: string
  title?: string
  priority?: string
  checklist_complete?: boolean
}

interface TasksResponse {
  tasks: TaskSummary[]
}

export const activeTaskAtom = atom<string | null>(null)

export function useTasks() {
  const queryClient = useQueryClient()
  const [activeTaskId, setActiveTaskId] = useAtom(activeTaskAtom)
  const tasksQuery = useQuery<TaskSummary[]>({
    queryKey: ['tasks'],
    queryFn: async () => {
      const response = await axios.get<TasksResponse>('/api/tasks')
      return response.data.tasks
    }
  })

  const selectTask = (taskId: string) => {
    setActiveTaskId(taskId)
    queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] })
  }

  const appendReorderLog = async (order: string[]) => {
    if (!activeTaskId) return
    try {
      await axios.post(`/api/tasks/${activeTaskId}/logs`, {
        ts: new Date().toISOString(),
        event: 'step_completed',
        status: 'success',
        agent: 'task_board',
        details: `Reordered tasks -> ${order.join(', ')}`
      })
    } catch (error) {
      console.error('Failed to append reorder log', error)
    }
  }

  const reorderMutation = useMutation({
    mutationFn: async (order: string[]) => {
      if (!order || order.length === 0) {
        throw new Error('Order must include at least one task id.')
      }
      await axios.patch('/api/tasks/order', { order })
      return order
    },
    onSuccess: async (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (Array.isArray(variables) && variables.length > 0) {
        await appendReorderLog(variables)
      }
    },
    onError: (err: unknown) => {
      console.error(err)
    }
  })

  return {
    tasks: tasksQuery.data ?? [],
    isLoading: tasksQuery.isLoading,
    error: tasksQuery.error,
    selectTask,
    activeTaskId,
    reorderTasks: (order: string[]) => reorderMutation.mutate(order),
    isReordering: reorderMutation.isPending
  }
}

export function useCreateTask(onCreated?: (taskId: string) => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { title: string; description: string; priority?: string }) => {
      const response = await axios.post('/api/tasks', payload)
      return response.data.task
    },
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
      if (task?.task_id) {
        onCreated?.(task.task_id as string)
      }
    }
  })
}
