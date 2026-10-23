import { get, post } from '../api/client'
import type { StartCounts } from '../api/types'
import { StepState } from '../components/StepState'
import { FLOW, STEPS, nextStep } from '../flows'
import { useAction } from '../hooks/useAction'
import { useKeys } from '../hooks/useKeys'
import { useLoad } from '../hooks/useLoad'
import { go } from '../hooks/useRoute'

export function Start() {
  const counts = useLoad(() => get<StartCounts>('/api/start'), 'start')
  const action = useAction(counts.reload)
  const data = counts.data

  const guess = async (): Promise<void> => {
    await action.run(
      () => post<number>('/api/prelabel'),
      (n) => `The model guessed ${n} cells. Next: ${data ? nextStep(data).name : 'the next step'}.`,
    )
  }

  useKeys({ Enter: () => data && go(nextStep(data).route) })
  return (
    <StepState load={counts} working="Counting the open work…">
      {(loaded) => <Overview data={loaded} note={action.note} busy={action.busy} guess={guess} />}
    </StepState>
  )
}

interface OverviewProps {
  data: StartCounts
  note: string | undefined
  busy: boolean
  guess: () => Promise<void>
}

function Overview({ data, note, busy, guess }: OverviewProps) {
  const next = nextStep(data)
  return (
    <div className="start">
      <header className="start-head">
        <h1>Cell labels</h1>
        <p>Each step shows what waits. The highlighted step is next.</p>
      </header>
      {note ? (
        <p className="note" role="status">
          {note}
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
            <button type="button" onClick={guess} disabled={busy}>
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
