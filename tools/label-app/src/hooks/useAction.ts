import { useState } from 'react'

import { post } from '../api/client'
import { errorMessage } from '../format'

export interface Action {
  busy: boolean
  /** What the last action did and what comes next, or why it failed. */
  note: string | undefined
  setNote: (note: string | undefined) => void
  /** Run one server call, then reload the step. `done` turns its result into the note. A failure becomes the note. */
  run: <T>(
    call: () => Promise<T>,
    done: (result: T) => string | undefined,
    options?: { reload?: boolean },
  ) => Promise<T | undefined>
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

/**
 * One action at a time per step, with the feedback line and the Z key's undo.
 * A refusal can follow a change on the server, so the step reloads after every call.
 */
export function useAction(reload: () => void): Action {
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | undefined>()
  const run = async <T>(
    call: () => Promise<T>,
    done: (result: T) => string | undefined,
    options: { reload?: boolean } = {},
  ) => {
    if (busy) return undefined
    setBusy(true)
    try {
      const result = await call()
      setNote(done(result))
      return result
    } catch (error) {
      setNote(errorMessage(error))
      return undefined
    } finally {
      setBusy(false)
      if (options.reload !== false) reload()
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
  }
  return { busy, note, setNote, run, undo }
}
