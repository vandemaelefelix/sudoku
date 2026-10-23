import { act, renderHook, waitFor } from '@testing-library/react-native'
import { okResult, printed } from '@/scan/scan.testkit'
import { cellLook } from '@/scan/utils/correction.utils'
import type { FinalGrid } from '@/utils/finalGrid.utils'
import { useSaveState } from './useSaveState'

const withPhoto = () => okResult({ 0: printed(5) }, { photoPath: '/tmp/photo.jpg' })
const looksOf = (scan: ReturnType<typeof okResult>) => scan.cells.map((cell) => cellLook(cell))

describe('canSave', () => {
  it('is true with the photo file and onSave only', () => {
    const scan = withPhoto()
    const looks = looksOf(scan)
    expect(renderHook(() => useSaveState(scan, looks, jest.fn())).result.current.canSave).toBe(true)
    expect(renderHook(() => useSaveState(scan, looks, undefined)).result.current.canSave).toBe(false)
    const bare = okResult()
    expect(renderHook(() => useSaveState(bare, looksOf(bare), jest.fn())).result.current.canSave).toBe(false)
    expect(renderHook(() => useSaveState(null, [], jest.fn())).result.current.canSave).toBe(false)
  })
})

describe('save', () => {
  it('hands the final grid to onSave and shows the status', async () => {
    const onSave = jest.fn(async (_grid: FinalGrid) => true)
    const scan = withPhoto()
    const looks = looksOf(scan)
    const { result } = renderHook(() => useSaveState(scan, looks, onSave))
    expect(result.current.saveState).toBe('idle')
    act(() => result.current.save())
    expect(result.current.saveState).toBe('saving')
    await waitFor(() => expect(result.current.saveState).toBe('saved'))
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0]![0]).toHaveLength(81)
  })

  it('does not start a second save while one runs', async () => {
    const pending: { finish: (saved: boolean) => void } = { finish: () => undefined }
    const onSave = jest.fn(() => new Promise<boolean>((resolve) => (pending.finish = resolve)))
    const scan = withPhoto()
    const looks = looksOf(scan)
    const { result } = renderHook(() => useSaveState(scan, looks, onSave))
    act(() => result.current.save())
    act(() => result.current.save())
    expect(onSave).toHaveBeenCalledTimes(1)
    await act(async () => pending.finish(true))
    expect(result.current.saveState).toBe('saved')
  })

  it('says when the save failed, and new looks make the saved copy old', async () => {
    const scan = withPhoto()
    const { result, rerender } = renderHook(
      ({ looks }: { looks: ReturnType<typeof looksOf> }) =>
        useSaveState(
          scan,
          looks,
          jest.fn(async () => false),
        ),
      { initialProps: { looks: looksOf(scan) } },
    )
    act(() => result.current.save())
    await waitFor(() => expect(result.current.saveState).toBe('failed'))
    rerender({ looks: looksOf(scan) })
    expect(result.current.saveState).toBe('idle')
  })

  it('does nothing without onSave or without a result', () => {
    const scan = withPhoto()
    const { result } = renderHook(() => useSaveState(scan, looksOf(scan), undefined))
    act(() => result.current.save())
    expect(result.current.saveState).toBe('idle')
    const none = renderHook(() => useSaveState(null, [], jest.fn()))
    act(() => none.result.current.save())
    expect(none.result.current.saveState).toBe('idle')
  })
})
