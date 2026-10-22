import { get, post } from '../api/client'
import type { StartCounts } from '../api/types'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

export function Prelabel() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'prelabel')
  const action = useAction(counts.reload)
  const waiting = counts.data?.not_prelabelled ?? 0

  const prelabel = async (): Promise<void> => {
    if (!waiting) return
    await action.run(
      () => post<number>('/api/prelabel'),
      (n) => `The model guessed ${n} cells. Next: Digits.`,
    )
    counts.reload()
  }

  useKeys({ Enter: prelabel, z: action.undo, Escape: () => go('') })

  return (
    <Frame
      flow="b"
      step="prelabel"
      task="The model guesses a digit and a kind for each loose cell. The server does this at its start."
      keys={[{ keys: 'Enter', does: 'Guess the cells without a guess' }]}
      note={action.note}
      action={
        waiting ? (
          <button type="button" className="primary" onClick={prelabel} disabled={action.busy}>
            Guess {waiting} cells <kbd>Enter</kbd>
          </button>
        ) : undefined
      }
    >
      {counts.error ? <Failure message={counts.error} retry={counts.reload} /> : null}
      {action.busy ? <Working what="The model reads the cells…" /> : null}
      {counts.data && !action.busy ? (
        waiting ? (
          <p className="panel">
            {waiting} loose cells have no guess yet. They stay out of the Digits step until they have one.
          </p>
        ) : (
          <Empty
            why="Every loose cell has a guess of the model."
            next={
              <button type="button" className="primary" onClick={() => go('b/digits')}>
                Next: Digits
              </button>
            }
          />
        )
      ) : null}
    </Frame>
  )
}
