import { useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useAtomValue } from 'jotai'
import { activeTaskAtom } from './useTasks'

export function useChecklistMutations(fallbackTaskId?: string) {
  const taskId = useAtomValue(activeTaskAtom) ?? fallbackTaskId
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async (params: { line: number; checked: boolean }) => {
      if (!taskId) throw new Error('No active task to update the checklist')
      await axios.patch(`/api/tasks/${taskId}/checklist`, params)
    },
    onSuccess: () => {
      if (!taskId) return
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] })
      queryClient.invalidateQueries({ queryKey: ['tasks'] })
    }
  })

  const toggle = (line: number, checked: boolean) => {
    mutation.mutate({ line, checked })
  }

  return { toggle, isPending: mutation.isPending }
}
