import { useState } from 'react'

import { ApiError, post } from '../api/client'
import type { FetchReport } from '../api/types'
import { Frame, Working } from '../components/Frame'
import { go, useKeys } from '../hooks'

const STAGES = ['production', 'dev', 'felix'] as const
type Stage = (typeof STAGES)[number]

type State =
  | { kind: 'idle' }
  | { kind: 'working' }
  | { kind: 'done'; report: FetchReport }
  | { kind: 'sign-in' }
  | { kind: 'signing-in' }
  | { kind: 'failed'; message: string }

function summary(report: FetchReport): string {
  if (report.pulled === 0) return `No new scans on ${report.stage}.`
  const scans = report.pulled === 1 ? '1 new scan' : `${report.pulled} new scans`
  return `Fetched ${scans} with ${report.cells} cells from ${report.stage}.`
}

function skipped(report: FetchReport): string[] {
  const lines = []
  if (report.missing_photo.length)
    lines.push(`${report.missing_photo.length} without a photo yet: they wait for the next fetch.`)
  if (report.invalid.length) lines.push(`${report.invalid.length} invalid: they stay in the table.`)
  if (report.fixture.length) lines.push(`${report.fixture.length} test fixtures: never used (SUD-10).`)
  return lines
}

export function Fetch() {
  const [stage, setStage] = useState<Stage>('production')
  const [state, setState] = useState<State>({ kind: 'idle' })

  const fetchScans = async (): Promise<void> => {
    if (state.kind === 'working') return
    setState({ kind: 'working' })
    try {
      setState({ kind: 'done', report: await post<FetchReport>('/api/fetch', { stage }) })
    } catch (error) {
      if (error instanceof ApiError && error.signIn) setState({ kind: 'sign-in' })
      else setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  const signIn = async (): Promise<void> => {
    try {
      await post('/api/aws-login')
      setState({ kind: 'signing-in' })
    } catch (error) {
      setState({ kind: 'failed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  useKeys({ Enter: fetchScans, Escape: () => go('') })

  return (
    <Frame
      step="fetch"
      task="Fetch the scans that players uploaded. The page finds the table and the bucket of the stage."
      keys={[{ keys: 'Enter', does: 'Fetch new scans' }]}
      action={
        <>
          <fieldset className="stages">
            <legend>Stage</legend>
            {STAGES.map((s) => (
              <label key={s} className={s === stage ? 'here' : undefined}>
                <input type="radio" name="stage" value={s} checked={s === stage} onChange={() => setStage(s)} />
                {s}
              </label>
            ))}
          </fieldset>
          <button type="button" className="primary" onClick={fetchScans} disabled={state.kind === 'working'}>
            Fetch new scans <kbd>Enter</kbd>
          </button>
        </>
      }
    >
      <div className="panel">
        {state.kind === 'idle' ? (
          <p>Nothing fetched yet in this visit. The cells of a new scan wait for an outline check first.</p>
        ) : null}
        {state.kind === 'working' ? <Working what={`Fetching the new scans of ${stage}…`} /> : null}
        {state.kind === 'done' ? (
          <>
            <p className="result">{summary(state.report)}</p>
            {skipped(state.report).map((line) => (
              <p key={line} className="muted">
                {line}
              </p>
            ))}
            <p>
              Next: check the outlines.{' '}
              <button type="button" onClick={() => go('outlines')}>
                Open Outlines
              </button>
            </p>
          </>
        ) : null}
        {state.kind === 'sign-in' ? (
          <>
            <p className="result">The AWS session expired.</p>
            <p>
              <button type="button" className="primary" onClick={signIn}>
                Sign in to AWS
              </button>
            </p>
          </>
        ) : null}
        {state.kind === 'signing-in' ? (
          <p className="result">
            A browser window opens for the sign-in. When it says you are signed in, press Enter to fetch again.
          </p>
        ) : null}
        {state.kind === 'failed' ? (
          <p className="result" role="alert">
            {state.message}
          </p>
        ) : null}
      </div>
    </Frame>
  )
}
