import { useMemo, useState } from 'react'
import type { MilestoneSummary } from '../hooks/useMilestones'
import type { TaskSummary } from '../hooks/useTasks'

interface MilestoneBoardProps {
  milestones: MilestoneSummary[]
  tasks: TaskSummary[]
  lastUpdated?: string
  isLoading: boolean
  filterIds?: Set<string>
  renderTaskCard: (summary: TaskSummary, options?: { compact?: boolean }) => JSX.Element
}

function buildTaskLookup(tasks: TaskSummary[]) {
  const map = new Map<string, TaskSummary>()
  tasks.forEach((task) => {
    const id = String(task.task_id ?? '')
    if (id) {
      map.set(id, task)
    }
  })
  return map
}

function MilestoneBoard({
  milestones,
  tasks,
  lastUpdated,
  isLoading,
  filterIds,
  renderTaskCard
}: MilestoneBoardProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const taskLookup = useMemo(() => buildTaskLookup(tasks), [tasks])

  if (isLoading) {
    return (
      <div className="milestone-strip">
        <div className="strip-header">
          <span>Milestones</span>
          <span className="strip-meta">Loading…</span>
        </div>
        <div className="strip-divider" />
      </div>
    )
  }

  return (
    <div className="milestone-strip">
      <div className="strip-header">
        <span>Milestones</span>
        {lastUpdated && <span className="strip-meta">Updated {new Date(lastUpdated).toLocaleString()}</span>}
      </div>
      <div className="strip-divider" />
      {milestones.length === 0 ? (
        <p className="strip-empty">No milestones defined yet.</p>
      ) : (
        milestones.map((milestone) => {
          const isExpanded = expanded[milestone.milestone_id] ?? true
          const toggle = () => setExpanded((prev) => ({ ...prev, [milestone.milestone_id]: !isExpanded }))
          const members = milestone.tasks
            ?.map((entry) => ({
              taskId: String(entry.task_id),
              summary: taskLookup.get(entry.task_id)
            }))
            .filter(({ taskId }) => !filterIds || filterIds.size === 0 || filterIds.has(taskId))

          if (!members || members.length === 0) {
            return filterIds ? null : (
              <div key={milestone.milestone_id} className="strip-section">
                <button type="button" className="strip-toggle" onClick={toggle} aria-expanded={isExpanded}>
                  <span className="strip-title">{milestone.title}</span>
                  <span className="strip-meta">0 tasks</span>
                  <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
                </button>
                <div className="strip-divider" />
                {isExpanded && <p className="strip-empty">No tasks to show.</p>}
              </div>
            )
          }
          return (
            <div key={milestone.milestone_id} className="strip-section">
              <button type="button" className="strip-toggle" onClick={toggle} aria-expanded={isExpanded}>
                <span className="strip-title">{milestone.title}</span>
                <span className="strip-meta">{members.length} tasks</span>
                <span className={`chevron ${isExpanded ? 'open' : ''}`}>▾</span>
              </button>
              <div className="strip-divider" />
              {isExpanded && (
                <ul className="task-list">
                  {members.map(({ taskId, summary }) => {
                    const normalized = summary ?? ({ task_id: taskId, title: taskId } as TaskSummary)
                    return renderTaskCard(normalized, { compact: true })
                  })}
                </ul>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

export default MilestoneBoard
