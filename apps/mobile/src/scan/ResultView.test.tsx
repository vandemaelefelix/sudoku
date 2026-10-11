import { fireEvent, render, screen } from '@testing-library/react-native'
import type { CellResult, RecogniseResult } from '../scanner'
import { ResultView } from './ResultView'

function cells(): CellResult[] {
  return Array.from({ length: 81 }, (_, n) => {
    if (n === 0) return { digit: 5, kind: 'printed', confidence: 0.99, validPair: true }
    if (n === 1) return { digit: 7, kind: 'handwritten', confidence: 0.95, validPair: true }
    return { digit: 0, kind: 'none', confidence: 0.99, validPair: true }
  })
}

const OK: RecogniseResult = {
  ok: true,
  cells: cells(),
  quad: [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
  ],
  corners: 'locked',
  cornerOffset: null,
  timings: { imageMs: 0, detectMs: 0, flattenMs: 0, classifyMs: 0 },
}

it('shows 81 cells with the digit and the kind', () => {
  render(<ResultView result={OK} onRetake={jest.fn()} />)
  expect(screen.getAllByTestId(/^result-cell-/)).toHaveLength(81)
  expect(screen.getByTestId('result-cell-0')).toHaveTextContent('5P')
  expect(screen.getByTestId('result-cell-1')).toHaveTextContent('7H')
  expect(screen.getByTestId('result-cell-2')).toHaveTextContent('')
})

it('shows the reason of a failure', () => {
  render(<ResultView result={{ ok: false, reason: 'no grid in the photo' }} onRetake={jest.fn()} />)
  expect(screen.getByTestId('result-failure')).toHaveTextContent('The scan failed: no grid in the photo')
  expect(screen.queryByTestId('result-cell-0')).toBeNull()
})

it('calls onRetake', () => {
  const onRetake = jest.fn()
  render(<ResultView result={OK} onRetake={onRetake} />)
  fireEvent.press(screen.getByTestId('retake'))
  expect(onRetake).toHaveBeenCalledTimes(1)
})
