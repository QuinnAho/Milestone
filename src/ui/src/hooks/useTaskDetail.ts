import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { useAtomValue } from 'jotai'
import { activeTaskAtom } from './useTasks'

export function useTaskDetail() {
  const taskId = useAtomValue(activeTaskAtom)
  const query = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: async () => {
      if (!taskId) {
        return null
      }
      const response = await axios.get(`/api/tasks/${taskId}`)
      return response.data
    },
    enabled: Boolean(taskId)
  })

  const data = query.data ?? null
  const checklistLines = data?.checklist ? (data.checklist as string).split(/\r?\n/) : []

  return {
    task: data?.task ?? null,
    checklistLines,
    progress: data?.progress ?? [],
    isLoading: query.isLoading
  }
}
