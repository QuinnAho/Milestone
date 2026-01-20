/// <reference types="node" />
import { renderToString } from 'react-dom/server'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import LogTimeline from './LogTimeline'

test('LogTimeline renders diff summary and files', () => {
  const entries = [
    {
      ts: '2026-01-16T00:00:00Z',
      event: 'step_completed',
      status: 'success',
      details: 'Rendered diff preview',
      diff: {
        summary: '1 file changed, 1 insertion(+)',
        files: ['src/foo.ts'],
        patch: '--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1 +1 @@\n-console.log("old")\n+console.log("hello")\n'
      }
    }
  ]
  const markup = renderToString(<LogTimeline entries={entries} />)
  assert.match(markup, /1 file changed/)
  assert.match(markup, /src\/foo\.ts/)
  assert.match(markup, /console\.log/)
  assert.match(markup, /log-diff-line meta/)
  assert.match(markup, /log-diff-line del/)
  assert.match(markup, /log-diff-line add/)
})
