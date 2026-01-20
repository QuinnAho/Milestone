
import type { DragEvent } from 'react'
import { useMemo, useState } from 'react'
import type { TaskSummary } from '../hooks/useTasks'
import { useTasks } from '../hooks/useTasks'
import { useMilestones } from '../hooks/useMilestones'
import MilestoneBoard from './MilestoneBoard'

function ordersMatch(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false
  }
  return a.every((value, index) => value === b[index])
}

function TaskBoard() {
  const { tasks, selectTask, activeTaskId, isLoading, reorderTasks, isReordering } = useTasks()
  const { milestones, lastUpdated: milestoneUpdatedAt, isLoading: milestonesLoading } = useMilestones()
  const [filter, setFilter] = useState('')
  const [previewOrder, setPreviewOrder] = useState<string[] | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)

  const orderedIds = useMemo(
    () => tasks.map((task) => String(task.task_id ?? '')).filter((id) => id.length > 0),
    [tasks]
  )
  const activeOrder = previewOrder ?? orderedIds

  const orderedTasks = useMemo(() => {
    if (tasks.length === 0) {
      return []
    }
    const map = new Map<string, TaskSummary>()
    tasks.forEach((task) => {
      const id = String(task.task_id ?? '')
      if (id) {
        map.set(id, task)
      }
    })
    const arranged: TaskSummary[] = []
    activeOrder.forEach((taskId) => {
      const summary = map.get(taskId)
      if (summary) {
        arranged.push(summary)
        map.delete(taskId)
      }
    })
    map.forEach((summary) => arranged.push(summary))
    return arranged
  }, [tasks, activeOrder])

  const filteredTasks = useMemo(() => {
    if (!filter) return orderedTasks
    const needle = filter.toLowerCase()
    return orderedTasks.filter((task) => {
      const title = String(task.title ?? '').toLowerCase()
      const id = String(task.task_id ?? '').toLowerCase()
      return title.includes(needle) || id.includes(needle)
    })
  }, [orderedTasks, filter])

  const filteredTaskIds = useMemo(() => {
    return new Set(filteredTasks.map((task) => String(task.task_id ?? '')))
  }, [filteredTasks])

  const hasMilestones = milestones.length > 0

  const updatePreview = (nextOrder: string[]) => {
    const currentOrder = previewOrder ?? orderedIds
    if (ordersMatch(currentOrder, nextOrder)) {
      return
    }
    setPreviewOrder(nextOrder)
  }

  const handleDragStart = (taskId: string) => (event: DragEvent<HTMLLIElement>) => {
    setDraggingTaskId(taskId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', taskId)
  }

  const handleDragOverTask = (taskId: string) => (event: DragEvent<HTMLLIElement>) => {
    event.preventDefault()
    if (!draggingTaskId || draggingTaskId === taskId) return
    const currentOrder = previewOrder ?? orderedIds
    const withoutDragging = currentOrder.filter((id) => id !== draggingTaskId)
    const targetIndex = withoutDragging.indexOf(taskId)
    if (targetIndex === -1) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const shouldPlaceAfter = event.clientY - rect.top > rect.height / 2
    const insertIndex = shouldPlaceAfter ? targetIndex + 1 : targetIndex
    const nextOrder = [...withoutDragging]
    nextOrder.splice(Math.max(0, Math.min(nextOrder.length, insertIndex)), 0, draggingTaskId)
    updatePreview(nextOrder)
  }

  const moveDraggingToEnd = () => {
    if (!draggingTaskId) return
    const currentOrder = previewOrder ?? orderedIds
    if (currentOrder.length === 0) return
    if (!currentOrder.includes(draggingTaskId)) return
    const withoutDragging = currentOrder.filter((id) => id !== draggingTaskId)
    if (currentOrder[currentOrder.length - 1] === draggingTaskId) return
    updatePreview([...withoutDragging, draggingTaskId])
  }

  const finalizeReorder = () => {
    if (previewOrder && !ordersMatch(previewOrder, orderedIds)) {
      reorderTasks(previewOrder)
    }
    setPreviewOrder(null)
    setDraggingTaskId(null)
  }

  const cancelDrag = () => {
    setPreviewOrder(null)
    setDraggingTaskId(null)
  }

  const renderTaskCard = (summary: TaskSummary, options?: { compact?: boolean }) => {
    const taskId = summary.task_id as string
    const priority = String(summary.priority ?? '').toUpperCase()
    const isComplete = Boolean(summary.checklist_complete)
    const cardClass = [
      'task-card',
      options?.compact ? 'task-card-compact' : '',
      taskId === activeTaskId ? 'active' : '',
      isComplete ? 'completed' : '',
      draggingTaskId === taskId ? 'dragging' : ''
    ]
      .filter(Boolean)
      .join(' ')
    const badgeClass = ['badge', `badge-${priority.toLowerCase()}`]
      .filter(Boolean)
      .join(' ')

    return (
      <li
        key={taskId}
        className={cardClass}
        onClick={() => selectTask(taskId)}
        draggable={!isReordering}
        onDragStart={handleDragStart(taskId)}
        onDragOver={handleDragOverTask(taskId)}
        onDrop={(event) => {
          event.preventDefault()
          event.stopPropagation()
          finalizeReorder()
        }}
        onDragEnd={cancelDrag}
      >
        <div className="task-card-main">
          <div>
            <strong>{summary.title}</strong>
            <div className="task-meta-line">{taskId}</div>
          </div>
          <span className={badgeClass}>{priority || 'N/A'}</span>
        </div>
        {isComplete && (
          <div className="completion-overlay" aria-hidden="true">
            <span>Finished</span>
          </div>
        )}
      </li>
    )
  }

  return (
    <div className="panel">
      <div className="panel-header tasks-panel-header">
        <input
          placeholder="Search tasks"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="tasks-header">
          <p className="tasks-hint">AI works top-to-bottom. Drag tasks so high-priority work stays at the top.</p>
        </div>
      </div>
      <MilestoneBoard
        milestones={milestones}
        tasks={tasks}
        lastUpdated={milestoneUpdatedAt}
        isLoading={milestonesLoading}
        filterIds={filter ? filteredTaskIds : undefined}
        renderTaskCard={(task) => renderTaskCard(task, { compact: true })}
      />
      {isLoading ? (
        <div>Loading tasks...</div>
      ) : !hasMilestones ? (
        <>
          <ul
            className="task-list"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault()
              finalizeReorder()
            }}
          >
            {filteredTasks.map((task) => renderTaskCard(task))}
          </ul>
        </>
      ) : null}
      {!isLoading && draggingTaskId && (
        <div className="task-drop-wrapper">
          <div
            className="task-drop-zone"
            onDragOver={(event) => {
              event.preventDefault()
              moveDraggingToEnd()
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              finalizeReorder()
            }}
          >
            Drop here to move task to the bottom
          </div>
        </div>
      )}
    </div>
  )
}

export default TaskBoard
