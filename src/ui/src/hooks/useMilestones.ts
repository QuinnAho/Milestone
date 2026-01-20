import { useQuery } from '@tanstack/react-query'
import axios from 'axios'

export interface MilestoneTaskRef extends Record<string, unknown> {
  task_id: string
  blocking?: boolean
  qa_required?: boolean
  status_override?: string
}

export interface MilestoneQaReview {
  status?: string
  checklist_path?: string
  log_path?: string
}

export interface MilestoneSummary extends Record<string, unknown> {
  milestone_id: string
  title: string
  status: string
  qa_review?: MilestoneQaReview
  tasks: MilestoneTaskRef[]
}

export interface MilestoneCollection {
  milestones: MilestoneSummary[]
  unassigned_tasks: string[]
  last_updated?: string
}

export function useMilestones() {
  const query = useQuery<MilestoneCollection>({
    queryKey: ['milestones'],
    queryFn: async () => {
      const response = await axios.get<MilestoneCollection>('/api/milestones')
      return response.data
    },
    staleTime: 30_000
  })

  return {
    milestones: query.data?.milestones ?? [],
    unassignedTaskIds: query.data?.unassigned_tasks ?? [],
    lastUpdated: query.data?.last_updated,
    isLoading: query.isLoading,
    error: query.error,
    refresh: () => query.refetch()
  }
}
