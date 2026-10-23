import type { ReactNode } from 'react'

import type { Loaded } from '../hooks/useLoad'
import { Empty, Failure, Working } from './Frame'

interface Props<T> {
  load: Pick<Loaded<T>, 'data' | 'error' | 'reload'>
  /** What the step does while its first data loads. */
  working: string
  /** What the step does while an action runs. */
  busy?: string | undefined
  /** Set when the data holds no work: why, and the button to the next step. */
  empty?: { why: string; next?: ReactNode } | undefined
  children: ReactNode | ((data: T) => ReactNode)
}

/** The Failure, Working and Empty branches of a step, then its content once the data is there. */
export function StepState<T>({ load, working, busy, empty, children }: Props<T>) {
  const { data, error } = load
  return (
    <>
      {error ? <Failure message={error} retry={load.reload} /> : null}
      {busy ? <Working what={busy} /> : null}
      {data === undefined && !error && !busy ? <Working what={working} /> : null}
      {data !== undefined && empty && !busy ? <Empty why={empty.why} next={empty.next} /> : null}
      {data === undefined ? null : typeof children === 'function' ? children(data) : children}
    </>
  )
}
