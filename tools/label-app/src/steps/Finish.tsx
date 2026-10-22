import { useState } from 'react'

import { get, post } from '../api/client'
import type { FinishResult, StartCounts } from '../api/types'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

export function Finish() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'finish')
  const action = useAction(counts.reload)
  const [result, setResult] = useState<FinishResult | undefined>()
  const changes = counts.data?.changes ?? 0

  const finish = async (): Promise<void> => {
    if (!changes || action.busy) return
    const done = await action.run(
      () => post<FinishResult>('/api/finish'),
      () => 'Finished. Z can no longer undo these changes. Git keeps the old tables.',
    )
    if (done) setResult(done)
    counts.reload()
  }

  useKeys({ Enter: finish, z: action.undo, Escape: () => go('') })

  return (
    <Frame
      step="finish"
      task="Finish folds the changes into the tables and checks the data. Then commit the tables."
      keys={[{ keys: 'Enter', does: 'Finish' }]}
      note={action.note}
      action={
        changes && !result ? (
          <button type="button" className="primary" onClick={finish} disabled={action.busy}>
            Finish {changes} changes <kbd>Enter</kbd>
          </button>
        ) : undefined
      }
    >
      {counts.error ? <Failure message={counts.error} retry={counts.reload} /> : null}
      {action.busy ? <Working what="Checking the data and writing the tables…" /> : null}
      {result ? (
        <div className="panel">
          <p className="result">Next: commit the tables with git add ml/dataset, then commit.</p>
          <pre className="report">{result.text}</pre>
        </div>
      ) : null}
      {counts.data && !changes && !result ? (
        <Empty
          why="Nothing to finish: every change is in the tables."
          next={
            <button type="button" className="primary" onClick={() => go('')}>
              Back to the start
            </button>
          }
        />
      ) : null}
      {counts.data && changes && !result && !action.busy ? (
        <p className="panel">
          {changes} changes wait in the journal. Until Finish, Z can undo them. A stop of the server keeps them.
        </p>
      ) : null}
    </Frame>
  )
}
