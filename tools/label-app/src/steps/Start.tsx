import { get, post } from '../api/client'
import type { StartCounts } from '../api/types'
import { Failure, Working } from '../components/Frame'
import { FLOW, STEPS, nextStep } from '../flows'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

export function Start() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'start')
  const action = useAction(counts.reload)
  const data = counts.data

  const guess = async (): Promise<void> => {
    await action.run(
      () => post<number>('/api/prelabel'),
      (n) => `The model guessed ${n} cells. Next: ${data ? nextStep(data).name : 'the next step'}.`,
    )
    counts.reload()
  }

  useKeys({ Enter: () => data && go(nextStep(data).route) })
  if (counts.error) return <Failure message={counts.error} retry={counts.reload} />
  if (!data) return <Working what="Counting the open work…" />
  const next = nextStep(data)
  return (
    <div className="start">
      <header className="start-head">
        <h1>Cell labels</h1>
        <p>Each step shows what waits. The highlighted step is next.</p>
      </header>
      {action.note ? (
        <p className="note" role="status">
          {action.note}
        </p>
      ) : null}
      {data.model === null || data.not_prelabelled > 0 ? (
        <div className="model-line" role="status">
          <p>
            {data.model === null
              ? 'No model guessed the cells yet. The check steps cannot order the cells by doubt.'
              : `${data.not_prelabelled} cells have no guess of the model run ${data.model}.`}
            {data.not_prelabelled > 0 ? ' They come last in the check steps until the model guesses them.' : null}
          </p>
          {data.not_prelabelled > 0 ? (
            <button type="button" onClick={guess} disabled={action.busy}>
              Guess them now
            </button>
          ) : null}
        </div>
      ) : null}
      <section className="flow-card" aria-label={FLOW.name}>
        <h2>{FLOW.name}</h2>
        <p className="about">{FLOW.about}</p>
        <ol className="flow-steps">
          {STEPS.map((s, n) => {
            const open = s.count(data)
            return (
              <li key={s.id} className={s.id === next.id ? 'next' : open ? 'open' : 'done'}>
                <a href={`#/${s.route}`}>
                  <span className="number">{n + 1}</span>
                  <span className="name">{s.name}</span>
                  <span className="count">{open ?? s.idle?.(data) ?? 'Done'}</span>
                </a>
              </li>
            )
          })}
        </ol>
        <button type="button" className="primary" onClick={() => go(next.route)}>
          Next: {next.name} <kbd>Enter</kbd>
        </button>
      </section>
      <section className="tools" aria-label="Tools">
        <h2>Tools</h2>
        <a className="tool" href="#/doubtful">
          <span className="name">Check older labels</span>
          <span className="count">
            {data.doubtful === null ? 'Not computed in this run' : `${data.doubtful} to check`}
          </span>
        </a>
      </section>
    </div>
  )
}
