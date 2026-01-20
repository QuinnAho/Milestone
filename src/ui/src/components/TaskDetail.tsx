import { useCallback, useState } from 'react'
import type { MouseEvent as ReactMouseEvent } from 'react'
import ChecklistPanel from './ChecklistPanel'
import LogTimeline from './LogTimeline'
import { useTaskDetail } from '../hooks/useTaskDetail'

const MIN_PROGRESS_LOG_HEIGHT = 160
const MAX_PROGRESS_LOG_HEIGHT = 600

const clampHeight = (value: number) =>
  Math.min(Math.max(value, MIN_PROGRESS_LOG_HEIGHT), MAX_PROGRESS_LOG_HEIGHT)

function TaskDetail() {
  const { task, checklistLines, progress, isLoading } = useTaskDetail()
  const [progressHeight, setProgressHeight] = useState(260)
  const [isResizing, setIsResizing] = useState(false)

  const beginProgressResize = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault()
      const startY = event.clientY
      const startHeight = progressHeight
      setIsResizing(true)

      function onMouseMove(moveEvent: MouseEvent) {
        const delta = moveEvent.clientY - startY
        setProgressHeight(clampHeight(startHeight + delta))
      }

      function stopDragging() {
        setIsResizing(false)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', stopDragging)
        window.removeEventListener('mouseleave', stopDragging)
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', stopDragging)
      window.addEventListener('mouseleave', stopDragging)
    },
    [progressHeight]
  )

  if (isLoading) {
    return <div className="panel">Loading task detail.</div>
  }

  if (!task) {
    return <div className="panel">Select a task to view details</div>
  }

  return (
    <div className="panel">
      <h2>{task.title}</h2>
      <p>{task.description}</p>
      <div className="task-meta">
        <span>Status: {task.status}</span>
        <span>Priority: {task.priority}</span>
        <span>Created: {task.created}</span>
      </div>
      <div className="section-separator" />
      <section className="task-section task-section-progress">
        <h3>Progress Log</h3>
        <div className="task-section-content" style={{ height: `${progressHeight}px` }}>
          <LogTimeline entries={progress} />
        </div>
      </section>
      <div
        className={`section-resize-handle ${isResizing ? 'is-resizing' : ''}`}
        role="separator"
        aria-label="Resize progress log"
        aria-orientation="horizontal"
        onMouseDown={beginProgressResize}
      />
      <section className="task-section task-section-checklist">
        <h3>Checklist</h3>
        <ChecklistPanel lines={checklistLines} taskId={task.task_id as string} />
      </section>
    </div>
  )
}

export default TaskDetail
