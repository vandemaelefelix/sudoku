import { renderHook } from '@testing-library/react-native'
import type { CellLook } from '@/scan/utils/correction.utils'
import { useScanExit } from './useScanExit'

const A: CellLook[] = [{ digit: '1', style: 'given', uncertain: false }]
const B: CellLook[] = [{ digit: '2', style: 'entry', uncertain: false }]

it('reports the latest looks when an editable screen unmounts', () => {
  const onExit = jest.fn()
  const { rerender, unmount } = renderHook((p: { looks: CellLook[] }) => useScanExit(p.looks, true, onExit), {
    initialProps: { looks: A },
  })
  rerender({ looks: B })
  expect(onExit).not.toHaveBeenCalled()
  unmount()
  expect(onExit).toHaveBeenCalledWith(B)
})

it('does not report after a Retake', () => {
  const onExit = jest.fn()
  const { result, unmount } = renderHook(() => useScanExit(A, true, onExit))
  result.current()
  unmount()
  expect(onExit).not.toHaveBeenCalled()
})

it('does not report a screen that was never editable, such as a transition that ends early', () => {
  const onExit = jest.fn()
  renderHook(() => useScanExit(A, false, onExit)).unmount()
  expect(onExit).not.toHaveBeenCalled()
})

it('does nothing without a callback', () => {
  expect(() => renderHook(() => useScanExit(A, true, undefined)).unmount()).not.toThrow()
})
