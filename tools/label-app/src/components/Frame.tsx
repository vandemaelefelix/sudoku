import { useState, type ReactNode } from 'react'

import { useKeys } from '../hooks'
import { FLOW, STEPS } from '../flows'

export interface KeyHelp {
  keys: string
  does: string
}

/** The keys of every step. A step adds its own in front. */
const COMMON_KEYS: KeyHelp[] = [
  { keys: 'Z', does: 'Undo the last change' },
  { keys: 'Esc', does: 'Go back' },
  { keys: '?', does: 'Show or hide these keys' },
]

interface Props {
  /** A step id of the flow, or `doubtful` for the tool outside the flow. */
  step: string
  /** One sentence: what to do on this step. */
  task: ReactNode
  keys: KeyHelp[]
  /** The feedback of the last action: what it did and what comes next. */
  note?: ReactNode | undefined
  /** The main action, at the bottom. */
  action?: ReactNode | undefined
  children: ReactNode
}

export function Frame({ step, task, keys, note, action, children }: Props) {
  const [help, setHelp] = useState(false)
  useKeys({ '?': () => setHelp((open) => !open) })
  return (
    <div className="frame">
      <header className="bar">
        <a className="home" href="#/">
          Labels
        </a>
        <span className="flow-name">{step === 'doubtful' ? 'Tool: Check older labels' : FLOW.name}</span>
        <ol className="crumbs">
          {STEPS.map((s, n) => (
            <li key={s.id} className={s.id === step ? 'here' : undefined}>
              <a href={`#/${s.route}`}>
                <span className="number">{n + 1}</span> {s.name}
              </a>
            </li>
          ))}
        </ol>
        <button type="button" className="quiet keys-button" onClick={() => setHelp((open) => !open)}>
          ? Keys
        </button>
      </header>
      <main className="step">
        <p className="task">{task}</p>
        {note ? (
          <p className="note" role="status">
            {note}
          </p>
        ) : null}
        {children}
      </main>
      {action ? <footer className="actions">{action}</footer> : null}
      {help ? (
        <div className="overlay" role="dialog" aria-label="Keys of this step" onClick={() => setHelp(false)}>
          <dl className="key-list">
            {[...keys, ...COMMON_KEYS].map((k) => (
              <div key={k.keys}>
                <dt>
                  <kbd>{k.keys}</kbd>
                </dt>
                <dd>{k.does}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </div>
  )
}

/** A step without work: why it is empty and what comes next. */
export function Empty({ why, next }: { why: string; next?: ReactNode }) {
  return (
    <div className="empty">
      <p>{why}</p>
      {next ? <div className="empty-next">{next}</div> : null}
    </div>
  )
}

export function Working({ what }: { what: string }) {
  return (
    <p className="working" role="status">
      <span className="spinner" aria-hidden="true" />
      {what}
    </p>
  )
}

export function Failure({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="failure" role="alert">
      <p>{message}</p>
      {retry ? (
        <button type="button" onClick={retry}>
          Try again
        </button>
      ) : null}
    </div>
  )
}
