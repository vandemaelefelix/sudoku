import { useState } from 'react'

import { post } from './api/client'

export interface Action {
  busy: boolean
  /** What the last action did and what comes next, or why it failed. */
  note: string | undefined
  setNote: (note: string | undefined) => void
  /** Run one server call. `done` turns its result into the note. A failure becomes the note. */
  run: <T>(call: () => Promise<T>, done: (result: T) => string | undefined) => Promise<T | undefined>
  undo: () => Promise<void>
}

/** One action at a time per step, with the feedback line and the Z key's undo. */
export function useAction(reload: () => void): Action {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | undefined>()
  const run = async <T>(call: () => Promise<T>, done: (result: T) => string | undefined) => {
    if (busy) return undefined
    setBusy(true)
    try {
      const result = await call()
      setNote(done(result))
      return result
    } catch (error) {
      setNote(error instanceof Error ? error.message : String(error))
      return undefined
    } finally {
      setBusy(false)
    }
  }
  const undo = async (): Promise<void> => {
    await run(
      () => post<number>('/api/undo'),
      (lines) => (lines ? 'Undid the last change.' : 'Nothing to undo in this session.'),
    )
    reload()
  }
  return { busy, note, setNote, run, undo }
}
