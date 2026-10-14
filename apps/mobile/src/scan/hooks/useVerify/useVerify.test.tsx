import { act, renderHook } from '@testing-library/react-native'
import { generate } from '@sudoku/core'
import type { CorrectedGrid } from '@/scan/utils/correctionEdit.utils'
import { useVerify } from './useVerify'

const puzzle = generate('medium', 11)
const open = puzzle.givens.findIndex((digit) => digit === 0)
const fullGrid = (): CorrectedGrid => ({
  givens: [...puzzle.givens],
  entries: puzzle.solution.map((digit, cell) => (puzzle.givens[cell] === 0 ? digit : 0)),
})

it('gives no verdict before the player taps Check', () => {
  const { result } = renderHook(() => useVerify(fullGrid(), true))
  expect(result.current.verdict).toBeNull()
})

it('gives the verdict after a tap, and follows later edits', () => {
  const { result, rerender } = renderHook(({ grid }: { grid: CorrectedGrid }) => useVerify(grid, true), {
    initialProps: { grid: fullGrid() },
  })
  act(() => result.current.verify())
  expect(result.current.verdict).toEqual({ status: 'solved' })

  const wrong = fullGrid()
  wrong.entries[open] = ((puzzle.solution[open] ?? 0) % 9) + 1
  rerender({ grid: wrong })
  expect(result.current.verdict).toEqual({ status: 'wrong', hints: { [open]: puzzle.solution[open] } })

  rerender({ grid: fullGrid() })
  expect(result.current.verdict).toEqual({ status: 'solved' })
})

it('gives no verdict while the grid is not full, and forgets the tap', () => {
  const { result, rerender } = renderHook(
    ({ grid, full }: { grid: CorrectedGrid; full: boolean }) => useVerify(grid, full),
    { initialProps: { grid: fullGrid(), full: true } },
  )
  act(() => result.current.verify())
  const emptied = fullGrid()
  emptied.entries[open] = 0
  rerender({ grid: emptied, full: false })
  expect(result.current.verdict).toBeNull()

  rerender({ grid: fullGrid(), full: true })
  expect(result.current.verdict).toBeNull()
})
