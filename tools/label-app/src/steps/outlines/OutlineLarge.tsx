import { useState } from 'react'

import { get, post } from '../../api/client'
import type { Corners, FixResult, Outline } from '../../api/types'
import { Frame } from '../../components/Frame'
import { StepState } from '../../components/StepState'
import { useAction } from '../../hooks/useAction'
import { useKeys } from '../../hooks/useKeys'
import { useLoad } from '../../hooks/useLoad'
import { go } from '../../hooks/useRoute'
import { CornerEditor } from './CornerEditor'
import { fixQueue, nextToFix, useWaiting } from './fixQueue'
import { inset, roundCorners, turn } from './geometry'

// Save and Reject move to the next photo: a reload would ask the server for the photo that the step leaves.
const LEAVE = { reload: false }

export function OutlineLarge({ photo }: { photo: string }) {
  const one = useLoad(() => get<Outline>(`/api/outline?photo=${photo}`), photo)
  const [corners, setCorners] = useState<Corners | null>(null)
  const action = useAction(one.reload)
  const waiting = useWaiting()
  const data = one.data?.photo === photo ? one.data : undefined

  const [shown, setShown] = useState<string>('')
  if (data && shown !== photo) {
    setShown(photo)
    setCorners(data.corners ?? inset(data.width, data.height))
  }

  const save = async (): Promise<void> => {
    if (!corners) return
    const result = await action.run(
      () => post<FixResult>('/api/outlines/fix', { photo, corners: roundCorners(corners) }),
      (r) => `Saved the corners of ${photo} and cut ${r.cells} new cells.`,
      LEAVE,
    )
    if (result) nextToFix(`Saved the corners of ${photo}. Next: Cells per digit.`)
  }

  const reject = async (): Promise<void> => {
    const result = await action.run(
      () => post<number>('/api/outlines/reject', { photo }),
      () => 'Rejected the scan. Its cells never train.',
      LEAVE,
    )
    if (result !== undefined) nextToFix(`Rejected ${photo}. Its cells never train.`)
  }

  useKeys({
    Enter: save,
    r: reject,
    t: () => corners && setCorners(turn(corners)),
    z: action.undo,
    Escape: () => {
      fixQueue.clear()
      go('outlines')
    },
  })

  return (
    <Frame
      step="outlines"
      task="Drag the 4 corners onto the outer corners of the grid. Enter cuts the 81 cells again. R rejects the photo."
      keys={[
        { keys: 'Drag', does: 'Move a corner' },
        { keys: 'Enter', does: 'Save the corners and cut the cells again' },
        { keys: 'T', does: 'Turn the grid a quarter: for sideways digits' },
        { keys: 'R', does: 'Reject the photo: its cells never train' },
        { keys: 'Esc', does: 'Back to the gallery. The outline stays unchecked' },
      ]}
      note={action.note ?? (waiting ? `${waiting} more marked after this one.` : undefined)}
      action={
        data ? (
          <>
            <button type="button" onClick={reject} disabled={action.busy}>
              Reject <kbd>R</kbd>
            </button>
            <button type="button" className="primary" onClick={save} disabled={action.busy}>
              Save the corners <kbd>Enter</kbd>
            </button>
          </>
        ) : undefined
      }
    >
      <StepState load={{ data, error: one.error, reload: one.reload }} working="Opening the photo…">
        {(outline) =>
          corners ? (
            <CornerEditor
              key={photo}
              photo={photo}
              width={outline.width}
              height={outline.height}
              corners={corners}
              onChange={setCorners}
            />
          ) : null
        }
      </StepState>
    </Frame>
  )
}
