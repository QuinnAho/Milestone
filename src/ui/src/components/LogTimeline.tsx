interface LogTimelineProps {
  entries: Record<string, unknown>[]
}

const diffMetaPrefixes = ['@@', 'diff', 'index', '---', '+++']

function getDiffLineClass(line: string) {
  if (line.startsWith('+')) {
    return 'log-diff-line add'
  }
  if (line.startsWith('-')) {
    return 'log-diff-line del'
  }
  if (diffMetaPrefixes.some((prefix) => line.startsWith(prefix))) {
    return 'log-diff-line meta'
  }
  return 'log-diff-line'
}

function renderDiffPatch(patch: string) {
  return patch.split(/\r?\n/).map((line, idx) => (
    <span key={idx} className={getDiffLineClass(line)}>
      {line.length > 0 ? line : ' '}
      {'\n'}
    </span>
  ))
}

function LogTimeline({ entries }: LogTimelineProps) {
  if (entries.length === 0) {
    return <p>No log entries yet.</p>
  }

  return (
    <ul className="log-list">
      {entries.map((entry, index) => {
        const timestamp = String(entry.ts ?? '')
        const event = String(entry.event ?? '')
        const details = String(entry.details ?? '')
        const status = String(entry.status ?? '')
        const diff = (entry.diff ?? null) as Record<string, unknown> | null
        const diffSummary = diff && typeof diff.summary === 'string' ? diff.summary : null
        const diffFiles =
          diff && Array.isArray(diff.files)
            ? diff.files.filter((item): item is string => typeof item === 'string')
            : []
        const diffPatch = diff && typeof diff.patch === 'string' ? diff.patch : null
        const diffCommit = diff && typeof diff.commit === 'string' ? diff.commit : null
        return (
          <li key={index} className="log-item">
            <time>{timestamp}</time>
            <div>
              <strong>{event}</strong> - {details}
              {diffSummary && (
                <div className="log-diff">
                  <p className="log-diff-summary">{diffSummary}</p>
                  {diffFiles.length > 0 && (
                    <div className="log-diff-files">
                      <strong>Files:</strong>
                      <ul>
                        {diffFiles.map((file) => (
                          <li key={file}>{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diffCommit && (
                    <div className="log-diff-commit">
                      Commit: <code>{diffCommit}</code>
                    </div>
                  )}
                  {diffPatch && (
                    <details className="log-diff-patch">
                      <summary>View patch</summary>
                      <pre className="log-diff-patch-body">{renderDiffPatch(diffPatch)}</pre>
                    </details>
                  )}
                </div>
              )}
            </div>
            <small>{status}</small>
          </li>
        )
      })}
    </ul>
  )
}

export default LogTimeline
