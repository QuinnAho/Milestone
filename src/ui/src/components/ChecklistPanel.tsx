import { useChecklistMutations } from '../hooks/useChecklistMutations'

interface ChecklistPanelProps {
  lines: string[]
  taskId: string
}

function ChecklistPanel({ lines, taskId }: ChecklistPanelProps) {
  const { toggle, isPending } = useChecklistMutations(taskId)
  const parsedLines = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) => line.trim().startsWith('- ['))

  return (
    <ul className="checklist">
      {parsedLines.map(({ line, index }) => (
        <li key={index}>
          <button onClick={() => toggle(index, !line.includes('[x]'))} disabled={isPending}>
            {line.includes('[x]') ? '✔' : ''}
          </button>
          <span>{line.replace(/- \[[x ]\]\s*/, '')}</span>
        </li>
      ))}
    </ul>
  )
}

export default ChecklistPanel
