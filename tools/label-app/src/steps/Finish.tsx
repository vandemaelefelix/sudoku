import { useState } from 'react'

import { get, post } from '../api/client'
import type { FinishResult, StartCounts } from '../api/types'
import { Frame } from '../components/Frame'
import { StepState } from '../components/StepState'
import { useAction } from '../hooks/useAction'
import { useKeys } from '../hooks/useKeys'
import { useLoad } from '../hooks/useLoad'
import { go } from '../hooks/useRoute'

export function Finish() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'finish')
  const action = useAction(counts.reload)
  const [result, setResult] = useState<FinishResult | undefined>()
  const changes = counts.data?.changes ?? 0
  const kindCells = counts.data?.kind_cells ?? 0

  const finish = async (): Promise<void> => {
    if (!changes || kindCells > 0 || action.busy) return
    const done = await action.run(
      () => post<FinishResult>('/api/finish'),
      () => 'Finished. Z can no longer undo these changes. Git keeps the old tables.',
    )
    if (done) setResult(done)
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
          <>
            {kindCells > 0 ? (
              <>
                <span className="summary">
                  {kindCells} {kindCells === 1 ? 'cell waits' : 'cells wait'} in the Kind step. Check them first.
                </span>
                <button type="button" onClick={() => go('kinds')}>
                  Open Kind
                </button>
              </>
            ) : null}
            <button type="button" className="primary" onClick={finish} disabled={action.busy || kindCells > 0}>
              Finish {changes} changes <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      <StepState
        load={counts}
        working="Counting the open work…"
        busy={action.busy ? 'Checking the data and writing the tables…' : undefined}
        empty={
          changes || result
            ? undefined
            : {
                why: 'Nothing to finish: every change is in the tables.',
                next: (
                  <button type="button" className="primary" onClick={() => go('')}>
                    Back to the start
                  </button>
                ),
              }
        }
      >
        {result ? (
          <div className="panel">
            <p className="result">Next: commit the tables with git add ml/dataset, then commit.</p>
            <pre className="report">{result.text}</pre>
          </div>
        ) : null}
        {changes && !result && !action.busy ? (
          <p className="panel">
            {changes} changes wait in the journal. Until Finish, Z can undo them. A stop of the server keeps them.
          </p>
        ) : null}
      </StepState>
    </Frame>
  )
}
