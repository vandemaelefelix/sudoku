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

/** The journal `screen` of an action, in words. The old page wrote the same names. */
const UNDONE: Record<string, string> = {
  outlines: 'an outline check of an uploaded scan',
  scans: 'a page of cells of the scans',
  digits: 'a page of digits',
  kinds: 'a page of kinds',
  groups: 'a page of kinds',
  review: 'a page of doubtful labels',
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
      () => post<{ lines: number; what: string | null }>('/api/undo'),
      ({ what }) =>
        what
          ? `Undid the last change: ${UNDONE[what] ?? 'a change'}.`
          : 'Nothing to undo in this session. Undo cannot reverse the check of an imported photo.',
    )
    reload()
  }
  return { busy, note, setNote, run, undo }
}
