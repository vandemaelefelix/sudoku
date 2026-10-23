import { renderHook } from '@testing-library/react-native'
import { okResult, printed } from '@/scan/scanTestKit'
import { cellLook } from '@/scan/utils/correction.utils'
import { useExitReport } from './useExitReport'

const scan = okResult({ 0: printed(5) })
const looks = scan.cells.map((cell) => cellLook(cell))

describe('useExitReport', () => {
  it('reports the final grid when an editable screen unmounts', () => {
    const onExit = jest.fn()
    const { unmount } = renderHook(() => useExitReport({ ok: scan, looks, editable: true, onExit }))
    expect(onExit).not.toHaveBeenCalled()
    unmount()
    expect(onExit).toHaveBeenCalledTimes(1)
    const grid = onExit.mock.calls[0]![0]
    expect(grid).toHaveLength(81)
    expect(grid[0]).toEqual({ digit: 5, kind: 'printed', digitCorrected: false, kindCorrected: false })
  })

  it('reports the latest looks, not the looks of the first render', () => {
    const onExit = jest.fn()
    const { rerender, unmount } = renderHook(
      ({ current }: { current: typeof looks }) => useExitReport({ ok: scan, looks: current, editable: true, onExit }),
      { initialProps: { current: looks } },
    )
    rerender({ current: looks.map((look, cell) => (cell === 0 ? { ...look, digit: '8' } : look)) })
    unmount()
    expect(onExit.mock.calls[0]![0][0]).toMatchObject({ digit: 8, digitCorrected: true })
  })

  it('does not report after skip', () => {
    const onExit = jest.fn()
    const { result, unmount } = renderHook(() => useExitReport({ ok: scan, looks, editable: true, onExit }))
    result.current.skip()
    unmount()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('does not report a screen that was never editable, or one without a result', () => {
    const onExit = jest.fn()
    renderHook(() => useExitReport({ ok: scan, looks, editable: false, onExit })).unmount()
    renderHook(() => useExitReport({ ok: null, looks: [], editable: true, onExit })).unmount()
    expect(onExit).not.toHaveBeenCalled()
  })

  it('keeps the same skip between renders', () => {
    const { result, rerender } = renderHook(() => useExitReport({ ok: scan, looks, editable: true, onExit: undefined }))
    const first = result.current.skip
    rerender({})
    expect(result.current.skip).toBe(first)
  })
})
