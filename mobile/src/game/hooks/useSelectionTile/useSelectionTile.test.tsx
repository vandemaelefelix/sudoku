import { renderHook } from '@testing-library/react-native'
import * as Reanimated from 'react-native-reanimated'
import { TILE_SLIDE_MS } from './useSelectionTile.constants'
import { useSelectionTile } from './useSelectionTile'

const renderTile = () =>
  renderHook(({ cell, side }: { cell: number | null; side: number }) => useSelectionTile(cell, side), {
    initialProps: { cell: null as number | null, side: 360 },
  })

afterEach(() => jest.restoreAllMocks())

it('measures one cell to the next from the side of the grid', () => {
  const { result } = renderTile()
  expect(result.current.pitch.get()).toBe(40)
})

it('appears on the first selected cell at once, without a slide', () => {
  const timing = jest.spyOn(Reanimated, 'withTiming')
  const { result, rerender } = renderTile()
  expect(result.current.shown.get()).toBe(0)
  // Cell 21 is row 2, column 3.
  rerender({ cell: 21, side: 360 })
  expect(result.current).toMatchObject({ row: { value: 2 }, column: { value: 3 }, shown: { value: 1 } })
  expect(timing).not.toHaveBeenCalled()
})

it('slides to the next selected cell in TILE_SLIDE_MS, with the timing that follows Reduce Motion', () => {
  const timing = jest.spyOn(Reanimated, 'withTiming')
  const { result, rerender } = renderTile()
  rerender({ cell: 21, side: 360 })
  rerender({ cell: 80, side: 360 })
  expect(timing).toHaveBeenCalledWith(8, expect.objectContaining({ duration: TILE_SLIDE_MS }))
  // No reduceMotion option: the default follows the system setting, so the tile jumps with Reduce Motion.
  expect(timing.mock.calls.every(([, config]) => config?.reduceMotion === undefined)).toBe(true)
  expect(result.current.shown.get()).toBe(1)
})

it('goes at once when no cell is selected, as when a hint opens or the game pauses', () => {
  const { result, rerender } = renderTile()
  rerender({ cell: 21, side: 360 })
  rerender({ cell: null, side: 360 })
  expect(result.current.shown.get()).toBe(0)
})
