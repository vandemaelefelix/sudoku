import { useEffect, useState } from 'react'

import { get, post } from '../api/client'
import { DIGITS, type Digit, type DigitPage, type Label } from '../api/types'
import { DigitGallery, GALLERY_KEYS } from '../components/DigitGallery'
import { Empty, Failure, Frame, Working } from '../components/Frame'
import { go, useKeys, useLoad } from '../hooks'
import { useAction } from '../useAction'

const isDigit = (value: string | undefined): value is Digit => DIGITS.includes(value as Digit)

/** Flow B step 2: the loose cells per digit that the model read, the least sure first. */
export function Digits({ digit: asked }: { digit: string | undefined }) {
  const digit: Digit = isDigit(asked) ? asked : 'empty'
  const [round, setRound] = useState(0)
  const page = useLoad(() => get<DigitPage>(`/api/digits?digit=${digit}`), `${digit}:${round}`)
  const action = useAction(() => setRound((n) => n + 1))
  const data = page.data?.digit === digit ? page.data : undefined
  const total = data ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0
  // Without a digit in the route, open the first digit with cells.
  const first = page.data ? DIGITS.find((d) => page.data!.counts[d] > 0) : undefined
  useEffect(() => {
    if (!isDigit(asked) && first && first !== digit) go(`b/digits/${first}`)
  }, [asked, first, digit])

  const confirm = async (labels: Record<string, Label>): Promise<void> => {
    const cells = Object.entries(labels).map(([id, label]) => ({ id, digit: label }))
    const fixed = cells.filter((c) => c.digit !== digit).length
    await action.run(
      () => post<number>('/api/digits/assign', { cells }),
      () => `Confirmed ${cells.length} cells${fixed ? `, ${fixed} with a fix` : ''}.`,
    )
    setRound((n) => n + 1)
  }

  useKeys({ z: action.undo, Escape: () => go('') })

  return (
    <Frame
      flow="b"
      step="digits"
      task="Click each cell that is not this digit and type its right digit. Enter confirms the rest."
      keys={GALLERY_KEYS}
      note={action.note}
    >
      {page.error ? <Failure message={page.error} retry={page.reload} /> : null}
      {!data && !page.error ? <Working what="Loading the cells…" /> : null}
      {data && total === 0 ? (
        <Empty
          why={
            data.not_prelabelled
              ? `No loose cell has a guess. ${data.not_prelabelled} cells wait for the model.`
              : 'Every loose cell has a digit.'
          }
          next={
            <button
              type="button"
              className="primary"
              onClick={() => go(data.not_prelabelled ? 'b/prelabel' : 'b/kinds')}
            >
              Next: {data.not_prelabelled ? 'Pre-label' : 'Kind'}
            </button>
          }
        />
      ) : null}
      {data && total > 0 ? (
        <>
          {data.cells.length === 0 ? (
            <Empty why={`No loose cell reads as ${digit === 'empty' ? 'empty' : digit}. Pick another digit above.`} />
          ) : null}
          <DigitGallery
            digit={digit}
            counts={data.counts}
            cells={data.cells.map((c) => ({
              id: c.id,
              stem: c.stem,
              note: `${Math.round(c.p * 100)} %`,
              title: 'How sure the model is',
            }))}
            onDigit={(d) => go(`b/digits/${d}`)}
            onConfirm={confirm}
            busy={action.busy}
          />
        </>
      ) : null}
    </Frame>
  )
}
