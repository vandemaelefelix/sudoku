import { act, renderHook } from '@testing-library/react-native'
import type { CellResult, RecogniseResult } from '@/scanner'
import { useCorrectionEdits } from './useCorrectionEdits'

const empty = (): CellResult => ({ digit: 0, kind: 'none', confidence: 1, validPair: true })

function okResult(over: { [n: number]: Partial<CellResult> } = {}): RecogniseResult {
  const cells = Array.from({ length: 81 }, (_, n) => ({ ...empty(), ...over[n] }))
  return { ok: true, cells, quad: [] as never, corners: 'detected' as never, cornerOffset: null, timings: {} as never }
}

const printed = (digit: number, confidence = 1) => ({ digit, kind: 'printed', confidence }) as const

it('starts from the scanner result, with no cell selected', () => {
  const { result } = renderHook(() => useCorrectionEdits(okResult({ 0: printed(5) })))
  expect(result.current.looks[0]).toEqual({ digit: '5', style: 'given', uncertain: false })
  expect(result.current.selected).toBeNull()
})

it('has no looks without a result or after a failure', () => {
  expect(renderHook(() => useCorrectionEdits(null)).result.current.looks).toEqual([])
  expect(renderHook(() => useCorrectionEdits({ ok: false, reason: 'x' })).result.current.looks).toEqual([])
})

it('sets, switches and clears the selected cell', () => {
  const scan = okResult()
  const { result } = renderHook(() => useCorrectionEdits(scan))
  act(() => result.current.actions.select(4))
  act(() => result.current.actions.setDigit(8))
  expect(result.current.looks[4]).toEqual({ digit: '8', style: 'given', uncertain: false })
  act(() => result.current.actions.setKind('entry'))
  expect(result.current.looks[4]?.style).toBe('entry')
  act(() => result.current.actions.clear())
  expect(result.current.looks[4]?.style).toBe('empty')
  act(() => result.current.actions.deselect())
  expect(result.current.selected).toBeNull()
})

it('follows the count of cells to check', () => {
  const scan = okResult({ 0: printed(5, 0.2), 1: { confidence: 0.1 } })
  const { result } = renderHook(() => useCorrectionEdits(scan))
  expect(result.current.toCheck).toBe(2)
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.setDigit(6))
  expect(result.current.toCheck).toBe(1)
})

it('marks the conflicts and builds the corrected grid', () => {
  const { result } = renderHook(() =>
    useCorrectionEdits(okResult({ 0: printed(5), 8: printed(5), 9: { digit: 2, kind: 'handwritten', confidence: 1 } })),
  )
  expect(result.current.conflicts[0]).toBe(true)
  expect(result.current.conflicts[8]).toBe(true)
  expect(result.current.grid.givens[0]).toBe(5)
  expect(result.current.grid.entries[9]).toBe(2)
})

it('never changes the scanner result', () => {
  const scan = okResult({ 0: printed(5, 0.2) })
  const before = JSON.parse(JSON.stringify(scan))
  const { result } = renderHook(() => useCorrectionEdits(scan))
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.setKind('entry'))
  act(() => result.current.actions.setDigit(3))
  expect(scan).toEqual(before)
})

it('starts new edits for a new result', () => {
  const first = okResult({ 0: printed(5) })
  const { result, rerender } = renderHook(({ scan }: { scan: RecogniseResult | null }) => useCorrectionEdits(scan), {
    initialProps: { scan: first as RecogniseResult | null },
  })
  act(() => result.current.actions.select(0))
  act(() => result.current.actions.clear())
  rerender({ scan: okResult({ 0: printed(7) }) })
  expect(result.current.looks[0]?.digit).toBe('7')
  expect(result.current.selected).toBeNull()
})

it('keeps the actions the same between renders, so the memo of the cells holds', () => {
  const scan = okResult()
  const { result } = renderHook(() => useCorrectionEdits(scan))
  const before = result.current.actions
  act(() => result.current.actions.select(3))
  expect(result.current.actions).toBe(before)
})
